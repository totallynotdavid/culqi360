import {
  isExternalRuntimeMessage,
  isRuntimeMessage,
  type ExternalRuntimeMessage,
  type RuntimeMessage,
  type RuntimeResponse,
} from "@/src/domain/messages";
import { isLiveCall } from "@/src/domain/model";
import { read } from "@/src/services/database";
import { claimHandoff } from "@/src/services/external-auth";
import { migrateV1 } from "@/src/services/migration";
import { closeOffscreenDocument } from "@/src/services/offscreen";
import { interruptOrphanedRecordings } from "@/src/services/recording-lock";
import { readSession, writeSession } from "@/src/services/session";

import { syncBadge } from "./badge";
import {
  connectCall,
  endCall,
  latestCall,
  receiveHandoff,
  startCall,
} from "./calls";
import { startRecording, stopRecording } from "./recording";
import { errorResponse, stateResponse } from "./state";
import {
  ensureAlarms,
  enqueueHeartbeat,
  HEARTBEAT_ALARM,
  isSyncAlarm,
  retryDeadLetters,
  syncDue,
  syncNow,
} from "./sync";

/** Declared in the manifest as `commands["start-recording"]` (`wxt.config.ts`). */
const START_RECORDING_COMMAND = "start-recording";

const connectedPorts = new Set<chrome.runtime.Port>();

async function broadcast(): Promise<void> {
  if (connectedPorts.size === 0) {
    return;
  }
  const response = await stateResponse();
  for (const port of connectedPorts) {
    try {
      port.postMessage(response);
    } catch {
      connectedPorts.delete(port);
    }
  }
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function logFailure(context: string, error: unknown): void {
  console.error(`${context}: ${asErrorMessage(error)}`);
}

/**
 * Runs on every worker wake, before any handler: moves a v1 install over,
 * closes recordings whose recorder is gone and arms the alarms. The module
 * reruns on every browser start, install, update and idle wake, so this is
 * also the `onStartup` and `onInstalled` sweep. It never rejects.
 */
async function wake(): Promise<void> {
  try {
    await migrateV1();
    const interrupted = await interruptOrphanedRecordings();
    if (interrupted > 0) {
      afterChangeInBackground();
    }
    await ensureAlarms();
    await syncBadge();
  } catch (error: unknown) {
    logFailure("worker start failed", error);
  }
}

let ready: Promise<void> = Promise.resolve();

async function afterChange(): Promise<void> {
  await broadcast();
  await syncBadge().catch((error: unknown) =>
    logFailure("badge failed", error),
  );
  await syncDue();
}

function afterChangeInBackground(): void {
  afterChange().catch((error: unknown) => logFailure("sync failed", error));
}

async function perform(action: () => Promise<void>): Promise<RuntimeResponse> {
  try {
    await action();
  } catch (error: unknown) {
    return errorResponse(asErrorMessage(error));
  }
  afterChangeInBackground();
  return stateResponse();
}

async function endCallAndRecording(
  message: Extract<RuntimeMessage, { type: "call.end" }>,
): Promise<void> {
  await endCall({ outcome: message.outcome, notes: message.notes });
  const stopped = await stopRecording();
  if (!stopped.ok) {
    logFailure("recorder did not stop", stopped.error);
  }
}

async function startRecordingOf(tabId: number): Promise<RuntimeResponse> {
  const started = await startRecording(tabId);
  if (!started.ok) {
    return errorResponse(started.error);
  }
  afterChangeInBackground();
  return stateResponse();
}

/**
 * The shortcut is an activeTab invocation on the tab it was pressed in, which
 * is what lets `getMediaStreamId` name that tab. A failure is stored by
 * `startRecording`, and the dashboard shows it.
 */
async function startRecordingFromShortcut(
  tab: chrome.tabs.Tab | undefined,
): Promise<void> {
  await ready;
  if (tab?.id === undefined) {
    throw new Error("the shortcut was pressed in no tab");
  }
  const response = await startRecordingOf(tab.id);
  if (!response.ok) {
    logFailure("recording shortcut", new Error(response.error));
  }
}

async function handleMessage(
  message: RuntimeMessage,
): Promise<RuntimeResponse | undefined> {
  await ready;

  switch (message.type) {
    case "state.get":
      return stateResponse();
    case "call.start":
      return perform(startCall);
    case "call.connected":
      return perform(connectCall);
    case "call.end":
      return perform(() => endCallAndRecording(message));
    case "recording.start":
      return startRecordingOf(message.tabId);
    case "recording.stop":
      return perform(async () => {
        const stopped = await stopRecording();
        if (!stopped.ok) {
          throw new Error(stopped.error);
        }
      });
    case "recording.chunk":
      syncDue().catch((error: unknown) => logFailure("sync failed", error));
      return undefined;
    case "recording.finished":
      await closeOffscreenDocument();
      afterChangeInBackground();
      return undefined;
    case "sync.flush":
      return perform(syncNow);
    case "queue.retryDead":
      return perform(retryDeadLetters);
    default:
      return message satisfies never;
  }
}

function senderOrigin(sender: chrome.runtime.MessageSender): string | null {
  if (sender.origin) {
    return sender.origin;
  }
  return sender.url ? new URL(sender.url).origin : null;
}

async function acceptHandoff(
  token: string,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  if (isLiveCall(await read((tx) => latestCall(tx)))) {
    throw new Error("a call is already active");
  }
  const origin = senderOrigin(sender);
  if (origin === null) {
    throw new Error("handoff sender has no origin");
  }

  const stored = await readSession();
  const installationId = stored?.installationId ?? crypto.randomUUID();
  const claimed = await claimHandoff({ token, installationId, origin });
  if (!claimed.ok) {
    throw new Error(claimed.error);
  }

  // The claim awaited the server, so a call may have gone live since the check
  // above. `receiveHandoff` checks again, and a refused handoff must leave the
  // stored session (and its origin) alone.
  await receiveHandoff(claimed.value);
  await writeSession({
    installationId,
    origin,
    sessionToken: claimed.value.sessionToken,
    refreshToken: claimed.value.refreshToken,
  });
}

async function handleExternalMessage(
  message: ExternalRuntimeMessage,
  sender: chrome.runtime.MessageSender,
): Promise<RuntimeResponse> {
  await ready;

  switch (message.type) {
    case "state.get":
      return stateResponse();
    case "assignment.handoff":
      return perform(() => acceptHandoff(message.token, sender));
    default:
      return message satisfies never;
  }
}

async function handleAlarm(name: string): Promise<void> {
  await ready;
  // A recorder can die while the worker stays awake, so a wake-time sweep
  // alone would leave that recording open until the next browser start.
  await interruptOrphanedRecordings();
  if (name === HEARTBEAT_ALARM) {
    await enqueueHeartbeat();
  }
  await syncDue();
}

export function registerRuntime(): void {
  ready = wake();

  if (chrome.sidePanel?.setPanelBehavior) {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isRuntimeMessage(message)) {
      return Promise.resolve(errorResponse("invalid message payload"));
    }
    return handleMessage(message);
  });

  browser.runtime.onMessageExternal.addListener((message: unknown, sender) => {
    if (!isExternalRuntimeMessage(message)) {
      return Promise.resolve(errorResponse("invalid external message payload"));
    }
    return handleExternalMessage(message, sender);
  });

  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== START_RECORDING_COMMAND) {
      return;
    }
    startRecordingFromShortcut(tab).catch((error: unknown) =>
      logFailure("recording shortcut failed", error),
    );
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (!isSyncAlarm(alarm.name)) {
      return;
    }
    handleAlarm(alarm.name).catch((error: unknown) =>
      logFailure("alarm failed", error),
    );
  });

  chrome.runtime.onConnectExternal.addListener((port) => {
    connectedPorts.add(port);
    port.onDisconnect.addListener(() => connectedPorts.delete(port));
    stateResponse()
      .then((response) => port.postMessage(response))
      .catch((error: unknown) => logFailure("port greeting failed", error));
  });
}

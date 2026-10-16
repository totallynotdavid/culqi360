import { expect, type Page, type Worker } from "@playwright/test";

import type { RuntimeResponse } from "../../../src/domain/messages";
import {
  dumpDatabase,
  handOff,
  openPopupPage,
  sendRuntimeMessage,
  serviceWorkerOf,
  type DatabaseDump,
  type ExtensionSession,
} from "./extension-fixture";
import type { Receiver } from "./receiver";

export interface CallScenario {
  popup: Page;
  worker: Worker;
  callId: string;
  callTabId: number;
}

function expectOk(response: RuntimeResponse): void {
  expect(response, JSON.stringify(response)).toMatchObject({ ok: true });
}

/** Claims a handoff, dials and connects, with a call tab open. */
export async function beginCall(
  session: ExtensionSession,
  receiver: Receiver,
): Promise<CallScenario> {
  const popup = await openPopupPage(session);
  const handed = await handOff(session, receiver);
  expectOk(handed.response);

  const callId = receiver.callIds.at(-1);
  if (!callId) {
    throw new Error("the receiver minted no call");
  }
  expectOk(await sendRuntimeMessage(popup, { type: "call.start" }));
  expectOk(await sendRuntimeMessage(popup, { type: "call.connected" }));

  const callTab = await session.context.newPage();
  await callTab.goto(`${receiver.origin}/`);
  const worker = await serviceWorkerOf(session.context);
  const callTabId = await worker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    if (tab?.id === undefined) {
      throw new Error("call tab not found");
    }
    return tab.id;
  }, `${receiver.origin}/`);

  return { popup, worker, callId, callTabId };
}

export async function startRecording(scenario: CallScenario): Promise<void> {
  expectOk(
    await sendRuntimeMessage(scenario.popup, {
      type: "recording.start",
      tabId: scenario.callTabId,
    }),
  );
}

export async function stopRecording(scenario: CallScenario): Promise<void> {
  expectOk(
    await sendRuntimeMessage(scenario.popup, { type: "recording.stop" }),
  );
}

export async function flush(scenario: CallScenario): Promise<void> {
  expectOk(await sendRuntimeMessage(scenario.popup, { type: "sync.flush" }));
}

export async function database(page: Page): Promise<DatabaseDump> {
  const dump = await dumpDatabase(page);
  if (!dump) {
    throw new Error("the extension database does not exist");
  }
  return dump;
}

export async function rows(
  page: Page,
  store: string,
): Promise<Record<string, unknown>[]> {
  return (await database(page)).stores[store] ?? [];
}

export async function waitForChunks(page: Page, count: number): Promise<void> {
  await expect
    .poll(async () => (await rows(page, "chunks")).length, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(count);
}

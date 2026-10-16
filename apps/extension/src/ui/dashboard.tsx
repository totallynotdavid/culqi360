import { createSignal, onSettled, Show } from "solid-js";

import {
  connectCall,
  endCall,
  flushQueue,
  getState,
  isSuccessfulResponse,
  retryDeadQueue,
  startCall,
  startRecording,
} from "@/src/client/runtime-client";
import type { ExtensionState } from "@/src/domain/model";
import {
  MICROPHONE_NOT_ALLOWED,
  microphonePermission,
  openPermissionPage,
} from "@/src/services/microphone";

import "./dashboard.css";

const RESUME_NOTICE =
  "Click the extension icon on the call tab to resume recording";

interface DashboardProps {
  surface: "popup" | "sidepanel";
}

function formatTimestamp(value: number | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString();
}

function formatDurationSeconds(state: ExtensionState | null): string {
  const call = state?.call;
  if (!call?.connectedAt) return "0s";

  const endAt = call.endedAt ?? Date.now();
  const seconds = Math.max(0, Math.round((endAt - call.connectedAt) / 1000));
  return `${seconds}s`;
}

function classForSurface(surface: DashboardProps["surface"]): string {
  return surface === "popup" ? "surface-popup" : "surface-sidepanel";
}

function statusLabel(state: ExtensionState | null): string {
  return state?.call?.phase ?? "waiting_for_assignment";
}

export function Dashboard(props: DashboardProps) {
  const [state, setState] = createSignal<ExtensionState | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [microphoneGranted, setMicrophoneGranted] = createSignal(true);

  const refreshState = async () => {
    const response = await getState();
    if (!isSuccessfulResponse(response)) {
      setError(response.error);
      return;
    }

    setState(response.state);
    setError(null);
  };

  const run = async (
    task: () => Promise<{
      ok: boolean;
      error?: string;
      state?: ExtensionState;
    }>,
  ) => {
    const response = await task();
    if (!response.ok) {
      setError(response.error ?? "operation failed");
      if (response.state) {
        setState(response.state);
      }
      return;
    }

    setError(null);
    setState(response.state ?? null);
    await refreshState();
  };

  const openPermission = async () => {
    try {
      await openPermissionPage();
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "permission page failed",
      );
    }
  };

  onSettled(() => {
    void refreshState();
    const intervalId = window.setInterval(() => {
      void refreshState();
    }, 2500);

    return () => window.clearInterval(intervalId);
  });

  onSettled(() => {
    let permission: PermissionStatus | null = null;
    const follow = () => setMicrophoneGranted(permission?.state === "granted");

    // A permission state that cannot be read counts as not granted, so the
    // agent still gets the button that opens the page that can settle it.
    const watch = async () => {
      try {
        permission = await microphonePermission();
      } catch (reason: unknown) {
        console.error("microphone permission was not readable", reason);
        setMicrophoneGranted(false);
        return;
      }
      permission.onchange = follow;
      follow();
    };
    void watch();

    return () => {
      if (permission) {
        permission.onchange = null;
      }
    };
  });

  return (
    <main class={`dashboard ${classForSurface(props.surface)}`}>
      <header class="header">
        <p class="eyebrow">CRM extension</p>
        <h1>Assigned call companion</h1>
        <p class="muted">
          Web sends the assigned client. Extension keeps the runtime alive.
        </p>
      </header>

      <Show when={error()}>
        <p class="error">{error()}</p>
      </Show>

      <section class="card">
        <h2>Executive state</h2>
        <div class="stats-grid">
          <p>
            Status
            <strong>{statusLabel(state())}</strong>
          </p>
          <p>
            Queued jobs
            <strong>{state()?.queue.pending ?? 0}</strong>
          </p>
          <p>
            Client
            <strong>{state()?.call?.clientName ?? "No assigned client"}</strong>
          </p>
          <p>
            Phone
            <strong>{state()?.call?.phone ?? "-"}</strong>
          </p>
          <p>
            Last sync
            <strong>{formatTimestamp(state()?.sync.lastSyncAt ?? null)}</strong>
          </p>
          <p>
            Call duration
            <strong>{formatDurationSeconds(state())}</strong>
          </p>
          <p>
            Organization
            <strong>{state()?.call?.organizationLabel ?? "-"}</strong>
          </p>
        </div>
      </section>

      <section class="card">
        <h2>Current call</h2>
        <Show
          when={state()?.call}
          fallback={
            <p class="empty-copy">
              Select an assigned client in CRM to send the next number into the
              extension.
            </p>
          }
        >
          {(call) => (
            <div class="assignment-summary">
              <p>
                Client
                <strong>{call().clientName ?? "Unnamed contact"}</strong>
              </p>
              <p>
                Phone
                <strong>{call().phone}</strong>
              </p>
            </div>
          )}
        </Show>

        <div class="button-row">
          <button
            onClick={() => void run(() => startCall())}
            disabled={state()?.call?.phase !== "ready"}
          >
            Start call
          </button>
          <button
            class="secondary"
            onClick={() => void run(() => connectCall())}
          >
            Mark connected
          </button>
          <button class="secondary" onClick={() => void run(() => endCall())}>
            End call
          </button>
        </div>
      </section>

      <section class="card">
        <h2>Recording</h2>
        <div class="stats-grid">
          <p>
            State
            <strong>{state()?.recording.phase ?? "idle"}</strong>
          </p>
          <p>
            Saved chunks
            <strong>{state()?.recording.chunkCount ?? 0}</strong>
          </p>
        </div>
        <Show when={state()?.recording.startable}>
          <p class="muted" data-testid="resume-notice">
            {RESUME_NOTICE}
          </p>
          <div class="button-row">
            <button onClick={() => void run(() => startRecording())}>
              Record this tab
            </button>
          </div>
        </Show>
        <Show when={state()?.recording.captureError}>
          <p class="error" data-testid="capture-error">
            {state()?.recording.captureError}
          </p>
        </Show>
        <Show when={!microphoneGranted()}>
          <p class="error" data-testid="microphone-notice">
            {MICROPHONE_NOT_ALLOWED}
          </p>
          <div class="button-row">
            <button onClick={() => void openPermission()}>
              Allow microphone
            </button>
          </div>
        </Show>
        <Show when={state()?.recording.microphoneLost}>
          <p class="error" data-testid="microphone-lost">
            Microphone disconnected. Recording the tab only.
          </p>
        </Show>
      </section>

      <section class="card">
        <h2>Sync status</h2>
        <Show when={!state()?.sync.signedIn}>
          <p class="muted">
            Not signed in. Send the call from CRM again to sign in.
          </p>
        </Show>
        <Show when={state()?.sync.lastSyncError}>
          <p class="muted">Last error: {state()?.sync.lastSyncError}</p>
        </Show>
        <Show when={state()?.queue.dead}>
          <p class="error" data-testid="dead-letters">
            Failed jobs: {state()?.queue.dead}. The server refused them or they
            kept failing. They stay on this device until you retry them.
          </p>
        </Show>

        <div class="button-row">
          <button
            class="secondary"
            onClick={() => void run(() => flushQueue())}
          >
            Flush queue
          </button>
          <Show when={state()?.queue.dead}>
            <button onClick={() => void run(() => retryDeadQueue())}>
              Retry failed jobs
            </button>
          </Show>
        </div>
      </section>
    </main>
  );
}

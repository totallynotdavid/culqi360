import { createSignal, onSettled, Show } from "solid-js";

import {
  connectCall,
  endCall,
  flushQueue,
  getState,
  isSuccessfulResponse,
  startCall,
} from "@/src/client/runtime-client";
import type { ExtensionState } from "@/src/domain/model";

import "./dashboard.css";

interface DashboardProps {
  surface: "popup" | "sidepanel";
}

function formatTimestamp(value: number | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString();
}

function formatDurationSeconds(state: ExtensionState | null): string {
  if (!state?.currentCall) return "0s";
  const session = state.currentCall;

  if (!session.connectedAt) return "0s";
  const endAt = session.endedAt ?? Date.now();
  const seconds = Math.max(0, Math.round((endAt - session.connectedAt) / 1000));
  return `${seconds}s`;
}

function classForSurface(surface: DashboardProps["surface"]): string {
  return surface === "popup" ? "surface-popup" : "surface-sidepanel";
}

function statusLabel(state: ExtensionState | null): string {
  return state?.handoff
    ? `${state.currentCall?.phase ?? "ready"}`
    : "waiting_for_assignment";
}

export function Dashboard(props: DashboardProps) {
  const [state, setState] = createSignal<ExtensionState | null>(null);
  const [error, setError] = createSignal<string | null>(null);

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

  onSettled(() => {
    void refreshState();
    const intervalId = window.setInterval(() => {
      void refreshState();
    }, 2500);

    return () => window.clearInterval(intervalId);
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
            Queue jobs
            <strong>{state()?.queue.length ?? 0}</strong>
          </p>
          <p>
            Client
            <strong>
              {state()?.handoff?.clientName ?? "No assigned client"}
            </strong>
          </p>
          <p>
            Phone
            <strong>{state()?.handoff?.phone ?? "-"}</strong>
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
            <strong>{state()?.handoff?.organizationLabel ?? "-"}</strong>
          </p>
        </div>
      </section>

      <section class="card">
        <h2>Current handoff</h2>
        <Show
          when={state()?.handoff}
          fallback={
            <p class="empty-copy">
              Select an assigned client in CRM to send the next number into the
              extension.
            </p>
          }
        >
          {(handoff) => (
            <div class="assignment-summary">
              <p>
                Assignment
                <strong>#{handoff().assignmentId}</strong>
              </p>
              <p>
                Contact
                <strong>#{handoff().contactId}</strong>
              </p>
              <p>
                Client
                <strong>{handoff().clientName ?? "Unnamed contact"}</strong>
              </p>
              <p>
                Phone
                <strong>{handoff().phone}</strong>
              </p>
            </div>
          )}
        </Show>

        <div class="button-row">
          <button
            onClick={() => void run(() => startCall())}
            disabled={!state()?.handoff}
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
        <h2>Sync status</h2>
        <p class="muted">
          Sync configuration should come from the web handoff, not from manual
          entry in the extension.
        </p>
        <div class="button-row">
          <button
            class="secondary"
            onClick={() => void run(() => flushQueue())}
          >
            Flush queue
          </button>
        </div>
      </section>
    </main>
  );
}

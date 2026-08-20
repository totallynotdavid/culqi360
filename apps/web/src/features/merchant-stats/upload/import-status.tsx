import { revalidate, useAction, useSubmission } from "@solidjs/router";
import { Errored, For, Match, Show, Loading, Switch, createEffect, createMemo } from "solid-js";

import { createTopicState } from "~/browser/realtime/create-topic-state";
import { actionErrorMessage } from "~/contracts/errors";
import {
  parseGpvSnapshotProgressMessage,
  type GpvSnapshotProgressEvent,
} from "~/contracts/merchant-stats/imports";
import { REALTIME_CHANNELS } from "~/contracts/realtime/channel";
import { formatAppDateTime } from "~/domain/time/app-time";
import { WidgetCardShell } from "~/features/widgets/widget-card-shell";
import { WidgetSkeleton } from "~/features/widgets/widget-skeleton";
import { gpvSnapshotQuery } from "~/rpc/merchant-stats/gpv-snapshot";

import { resolveGpvImportIssueMutation } from "../data/mutations";
import { PUBLISHED_GPV_QUERY_KEYS } from "../data/revalidation";
import { formatInteger } from "../format";

import styles from "./upload-report.module.css";

export function ImportStatus(props: { snapshotId: string }) {
  const snapshot = createMemo(() => gpvSnapshotQuery(props.snapshotId));
  const resolveIssue = useAction(resolveGpvImportIssueMutation);
  const resolution = useSubmission(resolveGpvImportIssueMutation);
  let refreshedActiveSnapshotId: string | null = null;

  // Terminal jobs no longer publish progress.
  const jobId = () => {
    const job = snapshot()?.job;

    return !job || isTerminalJob(job.queueState) ? null : job.jobId;
  };

  // Progress invalidates the snapshot; the query remains the source of truth.
  const progress = createTopicState({
    channel: REALTIME_CHANNELS.gpvSnapshot,
    id: jobId,
    parse: parseGpvSnapshotProgressMessage,
    isFinal: (event) => isTerminalJob(event.queueState),
  });

  createEffect(progress.value, (event) => {
    if (!event) {
      return;
    }

    void revalidate(gpvSnapshotQuery.key);
  });

  createEffect(() => {
    const view = snapshot();

    if (
      view?.state !== "active" ||
      refreshedActiveSnapshotId === view.snapshotId
    ) {
      return;
    }

    refreshedActiveSnapshotId = view.snapshotId;
    void revalidate(PUBLISHED_GPV_QUERY_KEYS);
  });

  async function submitDecision(
    issueId: string,
    choice:
      | "keep_previous"
      | "accept_candidate"
      | "exclude_candidate"
      | "reject_snapshot",
  ): Promise<void> {
    try {
      await resolveIssue({ issueId, resolution: choice });
    } catch {
      // useSubmission renders the action error.
    }
  }

  return (
    <Errored
      fallback={
        <WidgetCardShell title="Importación GPV" status="error">
          <span />
        </WidgetCardShell>
      }
    >
      <Loading fallback={<WidgetSkeleton />}>
        <Show when={snapshot()}>
          {(view) => (
            <WidgetCardShell
              title="Importación GPV"
              action={
                <span class={styles.status}>
                  Corte {formatAppDateTime(new Date(view().cutAt))}
                </span>
              }
            >
              <div class={styles.panel}>
                <Show when={resolution.error}>
                  {(error) => (
                    <p class={styles.statusError}>
                      {actionErrorMessage(error())}
                    </p>
                  )}
                </Show>

                <Switch>
                  <Match
                    when={
                      view().state === "queued" || view().state === "processing"
                    }
                  >
                    <ImportProgress job={view().job} />

                    <Show when={progress.connection() === "offline"}>
                      <p class={styles.status}>Sin conexión. Reintentando...</p>
                    </Show>

                    <Show when={progress.connection() === "denied"}>
                      <p class={styles.statusError}>
                        Se perdió la conexión. Recarga la página.
                      </p>
                    </Show>
                  </Match>

                  <Match when={view().state === "needs_review"}>
                    <p class={styles.statusError}>
                      Esta actualización necesita una decisión antes de
                      publicarse.
                    </p>

                    <For each={view().issues}>
                      {(issue) => (
                        <div class={styles.reviewIssue}>
                          <p>{issue.detail}</p>

                          <div class={styles.reviewActions}>
                            <Show when={issue.type !== "row_rejected"}>
                              <DecisionButton
                                disabled={Boolean(resolution.pending)}
                                onClick={() =>
                                  void submitDecision(issue.id, "keep_previous")
                                }
                              >
                                Mantener anterior
                              </DecisionButton>

                              <DecisionButton
                                disabled={Boolean(resolution.pending)}
                                onClick={() =>
                                  void submitDecision(
                                    issue.id,
                                    "accept_candidate",
                                  )
                                }
                              >
                                {issue.type === "placement_missing"
                                  ? "Aceptar ausencia"
                                  : "Usar nuevo"}
                              </DecisionButton>
                            </Show>

                            <Show when={issue.type === "row_rejected"}>
                              <DecisionButton
                                disabled={Boolean(resolution.pending)}
                                onClick={() =>
                                  void submitDecision(
                                    issue.id,
                                    "exclude_candidate",
                                  )
                                }
                              >
                                Omitir fila inválida
                              </DecisionButton>
                            </Show>

                            <DecisionButton
                              disabled={Boolean(resolution.pending)}
                              onClick={() =>
                                void submitDecision(issue.id, "reject_snapshot")
                              }
                            >
                              Descartar actualización
                            </DecisionButton>
                          </div>
                        </div>
                      )}
                    </For>
                  </Match>

                  <Match when={view().state === "active"}>
                    <p class={styles.statusDone}>
                      La actualización está publicada.
                    </p>
                  </Match>

                  <Match when={view().state === "ready"}>
                    <p class={styles.statusDone}>
                      La actualización está lista para publicarse.
                    </p>
                  </Match>

                  <Match when={view().state === "superseded"}>
                    <p class={styles.status}>
                      Esta actualización fue reemplazada por una más reciente.
                    </p>
                  </Match>

                  <Match when={view().state === "rejected"}>
                    <p class={styles.status}>
                      La actualización fue descartada.
                    </p>
                  </Match>

                  <Match when={view().state === "failed"}>
                    <p class={styles.statusError}>
                      {view().job?.errorMessage ?? "La importación falló."}
                    </p>
                  </Match>
                </Switch>
              </div>
            </WidgetCardShell>
          )}
        </Show>
      </Loading>
    </Errored>
  );
}

function ImportProgress(props: { job: GpvSnapshotProgressEvent | null }) {
  const completed = () =>
    (props.job?.rowsApplied ?? 0) + (props.job?.rowsFailed ?? 0);
  const total = () => props.job?.rowsTotal ?? 0;

  return (
    <div>
      <p class={styles.status}>
        {total() === 0
          ? "Leyendo el archivo…"
          : `Procesando ${formatInteger(completed())} de ${formatInteger(
              total(),
            )} filas…`}
      </p>

      <div class={styles.bar}>
        <div
          class={styles.barFill}
          style={{
            width: `${total() ? (completed() / total()) * 100 : 0}%`,
          }}
        />
      </div>
    </div>
  );
}

function DecisionButton(props: {
  children: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class={styles.close}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function isTerminalJob(
  state: GpvSnapshotProgressEvent["queueState"] | undefined,
): boolean {
  return state === "done" || state === "failed";
}

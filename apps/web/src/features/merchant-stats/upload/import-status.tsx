import { revalidate, useAction, useSubmissions } from "@solidjs/router";
import {
  Errored,
  For,
  Match,
  Show,
  Loading,
  Switch,
  createEffect,
  createMemo,
  createOptimistic,
} from "solid-js";

import { createTopicState } from "~/browser/realtime/create-topic-state";
import { actionErrorMessage } from "~/contracts/errors";
import {
  parseGpvSnapshotProgressMessage,
  type GpvSnapshotProgressEvent,
  type GpvSnapshotView,
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

// The boundaries live here so the card below only ever sees a settled view.
// Keeping the realtime subscription and the revalidation effects inside the
// card means their reads suspend to this Loading rather than to an ancestor.
export function ImportStatus(props: { snapshotId: string }) {
  const snapshot = createMemo(() => gpvSnapshotQuery(props.snapshotId));

  return (
    <Loading fallback={<WidgetSkeleton />}>
      <Errored
        fallback={
          <WidgetCardShell title="Importación GPV" status="error">
            <span />
          </WidgetCardShell>
        }
      >
        <ImportSnapshotCard view={snapshot()} />
      </Errored>
    </Loading>
  );
}

function ImportSnapshotCard(props: { view: GpvSnapshotView }) {
  const resolveIssue = useAction(resolveGpvImportIssueMutation);
  const resolutions = useSubmissions(resolveGpvImportIssueMutation);

  // Tentative for the action's lifetime, so it reverts on settle without a
  // finally clause on either the success or the failure path.
  const [resolving, setResolving] = createOptimistic(false);
  resolveGpvImportIssueMutation.onSubmit(() => setResolving(true));

  const resolutionError = () => resolutions.at(-1)?.error;

  // Terminal jobs no longer publish progress.
  const jobId = () => {
    const job = props.view.job;

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

    revalidate(gpvSnapshotQuery.key);
  });

  // A memo, not the effect's compute: effects re-run on every dependency
  // change without comparing the computed value, so the dedupe that keeps
  // this to one republish per snapshot has to happen here.
  const publishedSnapshotId = createMemo(() =>
    props.view.state === "active" ? props.view.snapshotId : null,
  );

  createEffect(publishedSnapshotId, (snapshotId) => {
    if (snapshotId) {
      revalidate(PUBLISHED_GPV_QUERY_KEYS);
    }
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
      // A direct action call rethrows; the settled submission renders it.
    }
  }

  return (
    <WidgetCardShell
      title="Importación GPV"
      action={
        <span class={styles.status}>
          Corte {formatAppDateTime(new Date(props.view.cutAt))}
        </span>
      }
    >
      <div class={styles.panel}>
        <Show when={resolutionError()}>
          {(error) => (
            <p class={styles.statusError}>{actionErrorMessage(error())}</p>
          )}
        </Show>

        <Switch>
          <Match
            when={
              props.view.state === "queued" || props.view.state === "processing"
            }
          >
            <ImportProgress job={props.view.job} />

            <Show when={progress.connection() === "offline"}>
              <p class={styles.status}>Sin conexión. Reintentando...</p>
            </Show>

            <Show when={progress.connection() === "denied"}>
              <p class={styles.statusError}>
                Se perdió la conexión. Recarga la página.
              </p>
            </Show>
          </Match>

          <Match when={props.view.state === "needs_review"}>
            <p class={styles.statusError}>
              Esta actualización necesita una decisión antes de publicarse.
            </p>

            <For each={props.view.issues}>
              {(issue) => (
                <div class={styles.reviewIssue}>
                  <p>{issue.detail}</p>

                  <div class={styles.reviewActions}>
                    <Show when={issue.type !== "row_rejected"}>
                      <DecisionButton
                        disabled={resolving()}
                        onClick={() =>
                          void submitDecision(issue.id, "keep_previous")
                        }
                      >
                        Mantener anterior
                      </DecisionButton>

                      <DecisionButton
                        disabled={resolving()}
                        onClick={() =>
                          void submitDecision(issue.id, "accept_candidate")
                        }
                      >
                        {issue.type === "placement_missing"
                          ? "Aceptar ausencia"
                          : "Usar nuevo"}
                      </DecisionButton>
                    </Show>

                    <Show when={issue.type === "row_rejected"}>
                      <DecisionButton
                        disabled={resolving()}
                        onClick={() =>
                          void submitDecision(issue.id, "exclude_candidate")
                        }
                      >
                        Omitir fila inválida
                      </DecisionButton>
                    </Show>

                    <DecisionButton
                      disabled={resolving()}
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

          <Match when={props.view.state === "active"}>
            <p class={styles.statusDone}>La actualización está publicada.</p>
          </Match>

          <Match when={props.view.state === "ready"}>
            <p class={styles.statusDone}>
              La actualización está lista para publicarse.
            </p>
          </Match>

          <Match when={props.view.state === "superseded"}>
            <p class={styles.status}>
              Esta actualización fue reemplazada por una más reciente.
            </p>
          </Match>

          <Match when={props.view.state === "rejected"}>
            <p class={styles.status}>La actualización fue descartada.</p>
          </Match>

          <Match when={props.view.state === "failed"}>
            <p class={styles.statusError}>
              {props.view.job?.errorMessage ?? "La importación falló."}
            </p>
          </Match>
        </Switch>
      </div>
    </WidgetCardShell>
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

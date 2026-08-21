import { useAction } from "@solidjs/router";
import {
  createSignal,
  Errored,
  For,
  Loading,
  Match,
  Show,
  Switch,
  createMemo,
} from "solid-js";

import { createJob } from "~/browser/jobs/create-job";
import { createActionPending } from "~/browser/ui/action-in-flight";
import { actionErrorMessage } from "~/contracts/errors";
import { JOB_KINDS, type JobProgress } from "~/contracts/jobs/job-event";
import {
  parseGpvSnapshotDetail,
  type GpvSnapshotView,
} from "~/contracts/merchant-stats/imports";
import { formatAppDateTime } from "~/domain/time/app-time";
import { WidgetCardShell } from "~/features/widgets/widget-card-shell";
import { WidgetSkeleton } from "~/features/widgets/widget-skeleton";
import { gpvSnapshotQuery } from "~/rpc/merchant-stats/gpv-snapshot";

import { resolveGpvImportIssueMutation } from "../data/mutations";
import { formatInteger } from "../format";

import styles from "./upload-report.module.css";

type IssueResolution =
  | "keep_previous"
  | "accept_candidate"
  | "exclude_candidate"
  | "reject_snapshot";

// The boundaries live here so the card below only ever sees a settled view.
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
  const resolving = createActionPending(resolveGpvImportIssueMutation);
  const [resolutionError, setResolutionError] = createSignal<unknown>(null);

  const isRunning = () =>
    props.view.state === "queued" || props.view.state === "processing";

  /**
   * Only a running import has anything to say, and the settling frame carries
   * the query keys it invalidated, so this view refreshes itself without
   * watching for a state transition to infer that from.
   */
  const job = createJob({
    kind: JOB_KINDS.gpvSnapshot,
    subjectId: () => (isRunning() ? props.view.snapshotId : null),
    parseDetail: parseGpvSnapshotDetail,
  });

  async function submitDecision(
    issueId: string,
    resolution: IssueResolution,
  ): Promise<void> {
    setResolutionError(null);

    try {
      await resolveIssue({ issueId, resolution });
    } catch (caught) {
      setResolutionError(caught);
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
          <Match when={isRunning()}>
            <ImportProgress progress={job()?.progress} />
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
              {props.view.jobError ?? "La importación falló."}
            </p>
          </Match>
        </Switch>
      </div>
    </WidgetCardShell>
  );
}

function ImportProgress(props: { progress: JobProgress | undefined }) {
  const completed = () =>
    (props.progress?.completed ?? 0) + (props.progress?.failed ?? 0);
  const total = () => props.progress?.total ?? 0;

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
          style={{ width: `${total() ? (completed() / total()) * 100 : 0}%` }}
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

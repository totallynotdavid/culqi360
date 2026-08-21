import { Errored, For, Loading, Show, createMemo } from "solid-js";

import { createJob } from "~/browser/jobs/create-job";
import { EmptyState } from "~/components/feedback/empty-state/empty";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Skeleton } from "~/components/ui/feedback/skeleton";
import { Button } from "~/components/ui/input/button";
import { FileInput } from "~/components/ui/input/file-input";
import { Input } from "~/components/ui/input/input";
import { Select } from "~/components/ui/input/select";
import {
  parseIngestJobDetail,
  type IngestJobStep,
} from "~/contracts/data-sources/ingest";
import { actionErrorMessage } from "~/contracts/errors";
import { JOB_KINDS } from "~/contracts/jobs/job-event";
import { listDataSourceKeysQuery } from "~/rpc/data-sources/ingest";

import {
  useDataSourceUpload,
  type UploadRow,
  type UploadRowPhase,
} from "./use-data-source-upload";

import styles from "./data-source-upload-section.module.css";

const STEP_LABELS: Record<IngestJobStep, string> = {
  queued: "En cola",
  staging: "Preparando archivo",
  gating: "Validando calidad",
  merging: "Fusionando datos",
  validating: "Validando resultado",
  materializing: "Actualizando proyección",
  complete: "Completado",
};

const LOCAL_PHASE_LABELS: Record<UploadRowPhase, string> = {
  idle: "Pendiente",
  hashing: "Calculando hash…",
  registering: "Registrando…",
  uploading: "Subiendo archivo…",
  tracking: "En cola",
  failed: "Error",
};

// Only the browser's own phases block removal. A tracked row can be dropped:
// the engine keeps working and the server keeps following it either way.
function isRemovable(phase: UploadRowPhase): boolean {
  return phase === "idle" || phase === "tracking" || phase === "failed";
}

function UploadRowStatus(props: { row: UploadRow }) {
  const job = createJob({
    kind: JOB_KINDS.dataSourceIngest,
    subjectId: () => props.row.jobId,
    parseDetail: parseIngestJobDetail,
  });

  const label = () => {
    if (props.row.phase === "failed") {
      return props.row.error ? `Error: ${props.row.error}` : "Error";
    }

    const event = job();

    if (!event) {
      return LOCAL_PHASE_LABELS[props.row.phase];
    }

    if (event.state === "failed") {
      return event.errorMessage ? `Error: ${event.errorMessage}` : "Error";
    }

    return event.state === "done"
      ? "Completado"
      : STEP_LABELS[event.detail.step];
  };

  const failed = () =>
    props.row.phase === "failed" || job()?.state === "failed";

  return (
    <p class={styles.status} data-error={failed() ? "true" : undefined}>
      {label()}
    </p>
  );
}

export function DataSourceUploadSection() {
  const sources = createMemo(() => listDataSourceKeysQuery());
  const upload = useDataSourceUpload();
  const { enqueueErrorSnackBar } = useSnackBar();

  async function handleSubmit(): Promise<void> {
    try {
      await upload.submitAll();
    } catch (caught) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  return (
    <SettingsSection
      title="Fuentes de datos"
      description="Sube archivos CSV de fuentes externas (OSIPTEL, RUC, operadoras) para actualizar el motor de búsqueda."
    >
      <Loading fallback={<Skeleton height={96} />}>
        <Errored
          fallback={
            <EmptyState
              title="El motor no responde"
              description="No se pudieron leer las fuentes de datos. Intenta de nuevo en unos minutos."
            />
          }
        >
          <Show
            when={sources().length > 0}
            fallback={
              <EmptyState
                title="Sin fuentes disponibles"
                description="No hay fuentes de datos configuradas en el motor."
              />
            }
          >
            <div class={styles.rows}>
              <For
                each={upload.rows()}
                fallback={
                  <p class={styles.hint}>Agrega un archivo para comenzar.</p>
                }
              >
                {(row) => {
                  const locked = () => row.phase !== "idle";

                  return (
                    <div class={styles.row}>
                      <div class={styles.fields}>
                        <Select
                          label="Fuente"
                          value={row.sourceKey}
                          disabled={locked()}
                          onInput={(event) =>
                            upload.setSourceKey(
                              row.id,
                              event.currentTarget.value,
                            )
                          }
                        >
                          <For each={sources()}>
                            {(source) => (
                              <option value={source.source_key}>
                                {source.source_name}
                              </option>
                            )}
                          </For>
                        </Select>

                        <Input
                          label="Etiqueta"
                          value={row.snapshotLabel}
                          disabled={locked()}
                          onInput={(event) =>
                            upload.setSnapshotLabel(
                              row.id,
                              event.currentTarget.value,
                            )
                          }
                        />

                        <Input
                          type="date"
                          label="Fecha"
                          value={row.snapshotDate}
                          disabled={locked()}
                          onInput={(event) =>
                            upload.setSnapshotDate(
                              row.id,
                              event.currentTarget.value,
                            )
                          }
                        />

                        <FileInput
                          label="Archivo CSV"
                          accept=".csv"
                          disabled={locked()}
                          onChange={(event) =>
                            upload.setFile(
                              row.id,
                              event.currentTarget.files?.[0] ?? null,
                            )
                          }
                        />
                      </div>

                      <div class={styles.rowFooter}>
                        <UploadRowStatus row={row} />

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!isRemovable(row.phase)}
                          onClick={() => upload.removeRow(row.id)}
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>

            <div class={styles.actions}>
              <Button
                type="button"
                variant="outline"
                onClick={() => upload.addRow(sources()[0]?.source_key ?? "")}
              >
                Añadir archivo
              </Button>

              <Button
                type="button"
                disabled={
                  upload.isSubmitting() ||
                  !upload.rows().some((row) => row.file && row.phase === "idle")
                }
                loading={upload.isSubmitting()}
                onClick={() => void handleSubmit()}
              >
                Subir todo
              </Button>
            </div>
          </Show>
        </Errored>
      </Loading>
    </SettingsSection>
  );
}

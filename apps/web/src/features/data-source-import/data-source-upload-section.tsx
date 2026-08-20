import { For, Show, createMemo } from "solid-js";

import { EmptyState } from "~/components/feedback/empty-state/empty";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Button } from "~/components/ui/input/button";
import { FileInput } from "~/components/ui/input/file-input";
import { Input } from "~/components/ui/input/input";
import { Select } from "~/components/ui/input/select";
import type { IngestJobStep } from "~/contracts/data-sources/ingest";
import { actionErrorMessage } from "~/contracts/errors";
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

const LOCAL_PHASE_LABELS: Partial<Record<UploadRowPhase, string>> = {
  idle: "Pendiente",
  hashing: "Calculando hash…",
  registering: "Registrando…",
  uploading: "Subiendo archivo…",
};

function describeRow(row: UploadRow): string {
  if (row.phase === "failed") {
    return row.error ? `Error: ${row.error}` : "Error";
  }

  if (row.job) {
    return row.job.outcome === "succeeded"
      ? "Completado"
      : STEP_LABELS[row.job.step];
  }

  return LOCAL_PHASE_LABELS[row.phase] ?? row.phase;
}

function isRemovable(phase: UploadRowPhase): boolean {
  return phase === "idle" || phase === "done" || phase === "failed";
}

export function DataSourceUploadSection() {
  const sources = createMemo(() => listDataSourceKeysQuery(), {
    initialValue: [],
  });
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
                        upload.setSourceKey(row.id, event.currentTarget.value)
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
                    <p
                      class={styles.status}
                      data-error={row.phase === "failed" ? "true" : undefined}
                    >
                      {describeRow(row)}
                    </p>

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
    </SettingsSection>
  );
}

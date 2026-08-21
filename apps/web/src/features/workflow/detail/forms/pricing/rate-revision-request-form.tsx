import { useAction } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";

import Paperclip from "~/components/icons/paperclip";
import Trash from "~/components/icons/trash";
import { Button } from "~/components/ui/input/button";
import { FileDropzone } from "~/components/ui/input/file-dropzone";
import { actionErrorMessage } from "~/contracts/errors";
import { MAX_RATE_REVISION_FILES } from "~/contracts/workflow/limits";
import { uploadLeadRateRevisionFile } from "~/rpc/workflow/files";

import { requestRateRevisionMutation } from "../../../data/command-mutations";
import { revalidateWorkflowLead } from "../../../data/revalidate-workflow";

import styles from "../quoted.module.css";

type StagedFile = {
  fileId: string;
  filename: string;
  sizeBytes: number;
};

export function RateRevisionRequestForm(props: {
  leadId: string;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const requestRevision = useAction(requestRateRevisionMutation);

  const [justification, setJustification] = createSignal("");
  const [stagedFiles, setStagedFiles] = createSignal<StagedFile[]>([]);
  const [uploading, setUploading] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  async function handleUploadFiles(files: File[]) {
    if (files.length === 0 || uploading() || submitting()) {
      return;
    }

    setErrorMessage(null);

    if (stagedFiles().length + files.length > MAX_RATE_REVISION_FILES) {
      setErrorMessage(
        `Solo se pueden adjuntar hasta ${MAX_RATE_REVISION_FILES} archivos por solicitud`,
      );
      return;
    }

    setUploading(true);

    try {
      const results = await Promise.all(
        files.map((file) => {
          const formData = new FormData();

          formData.set("leadId", props.leadId);
          formData.set("file", file);

          return uploadLeadRateRevisionFile(formData);
        }),
      );

      const successes: StagedFile[] = [];
      const failures: string[] = [];

      for (const result of results) {
        if (result.ok) {
          successes.push({
            fileId: result.value.fileId,
            filename: result.value.filename,
            sizeBytes: result.value.sizeBytes,
          });
        } else {
          failures.push(actionErrorMessage(result.error));
        }
      }

      if (failures.length > 0) {
        setErrorMessage(
          failures.length === 1
            ? failures[0]
            : "Algunos archivos no se pudieron subir",
        );
      }

      if (successes.length > 0) {
        setStagedFiles((current) => [...current, ...successes]);
      }
    } catch (error) {
      setErrorMessage(actionErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  function removeStagedFile(fileId: string) {
    if (submitting()) {
      return;
    }

    setStagedFiles((current) =>
      current.filter((file) => file.fileId !== fileId),
    );
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (submitting() || uploading()) {
      return;
    }

    const trimmedJustification = justification().trim();
    const files = stagedFiles();

    if (!trimmedJustification) {
      setErrorMessage("El fundamento es requerido");
      return;
    }

    if (files.length === 0) {
      setErrorMessage("Se requiere al menos un documento de soporte");
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    try {
      await requestRevision({
        leadId: props.leadId,
        justification: trimmedJustification,
        fileIds: files.map((file) => file.fileId),
      });

      revalidateWorkflowLead(props.leadId);
      props.onSubmitted();
    } catch (error) {
      setErrorMessage(actionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class={styles.negotiationForm}>
      <p class={styles.negotiationFormTitle}>Solicitud de revisión de tarifa</p>

      <form onSubmit={(event) => void handleSubmit(event)}>
        <label class={styles.justificationLabel}>
          Fundamento
          <textarea
            class={styles.justificationTextarea}
            value={justification()}
            onInput={(event) => setJustification(event.currentTarget.value)}
            placeholder="Describe el motivo de la solicitud..."
            disabled={submitting()}
            required
          />
        </label>

        <div class={styles.fileSection}>
          <span class={styles.fileSectionLabel}>Documentos de soporte</span>

          <FileDropzone
            accept=".xlsx,.xls,.png,.jpg,.jpeg"
            multiple
            disabled={uploading() || submitting()}
            onFiles={(files) => void handleUploadFiles(files)}
          >
            {(dragging) => (
              <div
                class={`${styles.dropZone} ${
                  dragging ? styles.dropZoneDragging : ""
                }`}
              >
                <Paperclip size={14} />
                {uploading()
                  ? "Subiendo..."
                  : "Adjuntar archivos o arrastrar aquí"}
              </div>
            )}
          </FileDropzone>

          <Show when={stagedFiles().length > 0}>
            <div class={styles.stagedFiles}>
              <For each={stagedFiles()}>
                {(file) => (
                  <div class={styles.stagedFile}>
                    <span class={styles.stagedFileName}>{file.filename}</span>

                    <span class={styles.stagedFileSize}>
                      {formatBytes(file.sizeBytes)}
                    </span>

                    <button
                      type="button"
                      class={styles.removeFileButton}
                      aria-label={`Quitar ${file.filename}`}
                      disabled={submitting()}
                      onClick={() => removeStagedFile(file.fileId)}
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <Show when={errorMessage()}>
          {(message) => <p class={styles.error}>{message()}</p>}
        </Show>

        <div class={styles.formActions}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploading() || submitting()}
            onClick={props.onCancel}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting()}
            disabled={uploading()}
          >
            Enviar solicitud
          </Button>
        </div>
      </form>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

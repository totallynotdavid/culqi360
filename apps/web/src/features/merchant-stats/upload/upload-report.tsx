import { useAction, useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { FileDropzone } from "~/components/ui/input/file-dropzone";
import { InputHint } from "~/components/ui/input/input-hint";
import { InputLabel } from "~/components/ui/input/input-label";
import { TextInput } from "~/components/ui/input/text-input";
import { actionErrorMessage } from "~/contracts/errors";

import { uploadMerchantReportMutation } from "../data/mutations";

import styles from "./upload-report.module.css";

export function UploadReport() {
  const navigate = useNavigate();
  const upload = useAction(uploadMerchantReportMutation);
  const { enqueueErrorSnackBar } = useSnackBar();

  const [cutAt, setCutAt] = createSignal("");
  const [isUploading, setIsUploading] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string>();

  async function uploadFile(file: File): Promise<void> {
    if (isUploading()) {
      return;
    }

    const selectedCutAt = cutAt();
    const form = new FormData();

    form.append("file", file);

    if (selectedCutAt) {
      form.append("cutAt", selectedCutAt);
    }

    setErrorMessage(undefined);
    setIsUploading(true);

    try {
      const result = await upload(form);

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      navigate(`/dashboards/merchant-gpv/imports/${result.value.snapshotId}`);
    } catch (error: unknown) {
      const message = actionErrorMessage(error);

      setErrorMessage(message);
      enqueueErrorSnackBar(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div class={styles.panel}>
      <FileDropzone
        accept=".xlsx"
        disabled={isUploading()}
        onFiles={(files) => {
          const file = files[0];

          if (file) {
            void uploadFile(file);
          }
        }}
      >
        {(state) => (
          <div class={[styles.dropzone, state.dragging && styles.dragging]}>
            <p class={styles.dropTitle}>
              Arrastra el reporte GPV (.xlsx) o haz clic para elegir
            </p>
            <p class={styles.dropHint}>
              El reporte del dealer, tal como sale del sistema de Culqi.
            </p>
          </div>
        )}
      </FileDropzone>

      <div class={styles.cutField}>
        <InputLabel for="gpv-cut-at">Fecha de corte</InputLabel>
        <TextInput
          id="gpv-cut-at"
          type="datetime-local"
          value={cutAt()}
          disabled={isUploading()}
          onChange={setCutAt}
        />
        <InputHint>
          Se lee del nombre del archivo. Indícala solo si fue renombrado.
        </InputHint>
      </div>

      <Show when={isUploading()}>
        <p class={styles.status}>Subiendo archivo…</p>
      </Show>

      <Show when={errorMessage()}>
        {(message) => (
          <p class={styles.statusError} role="alert">
            {message()}
          </p>
        )}
      </Show>
    </div>
  );
}

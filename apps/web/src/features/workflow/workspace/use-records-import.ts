import { createEffect, createSignal } from "solid-js";

import { createJob } from "~/browser/jobs/create-job";
import type { SnackBarPatch } from "~/components/feedback/snack-bar-manager/types";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { actionErrorMessage } from "~/contracts/errors";
import { JOB_KINDS, type JobEvent } from "~/contracts/jobs/job-event";
import {
  parseRecordImportDetail,
  type RecordImportDetail,
  type RecordImportType,
} from "~/contracts/records/imports";
import { uploadRecordImportFile } from "~/rpc/records/imports";

const IMPORT_PROGRESS_DURATION_MS = 0;
const IMPORT_COMPLETED_DURATION_MS = 4_000;

function importTypeUnit(type: RecordImportType, count: number): string {
  if (type === "import_status") {
    return count === 1 ? "estado" : "estados";
  }

  return count === 1 ? "prioridad" : "prioridades";
}

function progressMessage(
  type: RecordImportType,
  processed: number,
  total: number,
): string {
  if (total <= 0) {
    return `Procesando ${importTypeUnit(type, 2)}...`;
  }

  return `Procesando ${importTypeUnit(type, total)}: ${processed} de ${total}`;
}

/** How one frame of an import reads in the snackbar it is being narrated to. */
function describeImport(event: JobEvent<RecordImportDetail>): SnackBarPatch {
  const { importType } = event.detail;
  const { completed, failed, total } = event.progress;

  if (event.state === "failed") {
    return {
      message: event.errorMessage ?? "La importación falló",
      variant: "error",
      duration: IMPORT_COMPLETED_DURATION_MS,
    };
  }

  if (event.state === "done") {
    const unit = importTypeUnit(importType, total);

    return {
      message:
        failed > 0
          ? `Procesados ${total} ${unit} (${failed} con error)`
          : `Procesados ${total} ${unit}`,
      variant: failed > 0 ? "warning" : "success",
      duration: IMPORT_COMPLETED_DURATION_MS,
    };
  }

  return { message: progressMessage(importType, completed + failed, total) };
}

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();

  return name.endsWith(".csv") || name.endsWith(".xlsx");
}

export function useRecordsImport() {
  const { enqueueInfoSnackBar, enqueueErrorSnackBar, updateSnackBar } =
    useSnackBar();

  let fileInputRef: HTMLInputElement | undefined;

  const [jobId, setJobId] = createSignal<string | null>(null);
  // A signal rather than a variable: the effect below reads it, so it has to
  // re-run once the snackbar the import narrates into exists.
  const [snackBarId, setSnackBarId] = createSignal<string | null>(null);

  const job = createJob({
    kind: JOB_KINDS.recordImport,
    subjectId: jobId,
    parseDetail: parseRecordImportDetail,
  });

  // Narrating into the snackbar queue is a side effect on an imperative API,
  // which is why this stayed an effect while the revalidation and connection
  // ones did not. Losing the feed is reported once by the shell instead.
  createEffect(
    () => ({ event: job(), id: snackBarId() }),
    ({ event, id }) => {
      if (event && id !== null) {
        updateSnackBar(id, describeImport(event));
      }
    },
  );

  async function importFile(file: File): Promise<void> {
    if (!isSupportedFile(file)) {
      enqueueErrorSnackBar("Solo se permiten archivos .csv o .xlsx");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    try {
      const result = await uploadRecordImportFile(formData);

      setSnackBarId(
        enqueueInfoSnackBar(
          progressMessage(result.importType, 0, result.rowsTotal),
          { duration: IMPORT_PROGRESS_DURATION_MS },
        ),
      );
      setJobId(result.jobId);
    } catch (error: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    }
  }

  function bindFileInput(element: HTMLInputElement): void {
    fileInputRef = element;
  }

  function openFilePicker(): void {
    fileInputRef?.click();
  }

  function onFileInputChange(event: Event): void {
    const target = event.currentTarget;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const file = target.files?.item(0);
    target.value = "";

    if (file) {
      void importFile(file);
    }
  }

  return {
    bindFileInput,
    openFilePicker,
    onFileInputChange,
    importFile,
  };
}

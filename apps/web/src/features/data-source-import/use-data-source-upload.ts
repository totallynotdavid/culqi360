import { createSignal } from "solid-js";
import { createStore } from "solid-js";

import type { IngestJob } from "~/contracts/data-sources/ingest";
import { actionErrorMessage } from "~/contracts/errors";
import {
  getDataSourceUploadJob,
  registerDataSourceUpload,
} from "~/rpc/data-sources/ingest";

export type UploadRowPhase =
  | "idle"
  | "hashing"
  | "registering"
  | "uploading"
  | "polling"
  | "done"
  | "failed";

export interface UploadRow {
  id: string;
  file: File | null;
  sourceKey: string;
  snapshotLabel: string;
  snapshotDate: string;
  phase: UploadRowPhase;
  job: IngestJob | null;
  error: string | null;
}

const POLL_INTERVAL_MS = 2000;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function createRow(defaultSourceKey: string): UploadRow {
  return {
    id: crypto.randomUUID(),
    file: null,
    sourceKey: defaultSourceKey,
    snapshotLabel: "",
    snapshotDate: todayIsoDate(),
    phase: "idle",
    job: null,
    error: null,
  };
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function uploadBlob(
  uploadId: string,
  file: File,
): Promise<{ jobId: string }> {
  const response = await fetch(
    `/api/data-sources/uploads/${encodeURIComponent(uploadId)}/blob`,
    {
      method: "PUT",
      body: file,
    },
  );

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "message" in body
        ? String(body.message)
        : `upload failed (${response.status})`;

    throw new Error(message);
  }

  return response.json();
}

export function useDataSourceUpload() {
  // Preserve row identity so <For> does not rebuild inputs on every edit.
  const [store, setStore] = createStore<{ rows: UploadRow[] }>({ rows: [] });
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const rows = () => store.rows;

  function patchRow(id: string, patch: Partial<UploadRow>): void {
    setStore((draft) => {
      const row = draft.rows.find((candidate) => candidate.id === id);

      if (row) {
        Object.assign(row, patch);
      }
    });
  }

  function addRow(defaultSourceKey: string): void {
    setStore((draft) => {
      draft.rows.push(createRow(defaultSourceKey));
    });
  }

  function removeRow(id: string): void {
    setStore((draft) => {
      draft.rows = draft.rows.filter((row) => row.id !== id);
    });
  }

  function setFile(id: string, file: File | null): void {
    patchRow(id, { file });
  }

  function setSourceKey(id: string, sourceKey: string): void {
    patchRow(id, { sourceKey });
  }

  function setSnapshotLabel(id: string, snapshotLabel: string): void {
    patchRow(id, { snapshotLabel });
  }

  function setSnapshotDate(id: string, snapshotDate: string): void {
    patchRow(id, { snapshotDate });
  }

  async function pollJob(rowId: string, jobId: string): Promise<void> {
    for (;;) {
      // Each poll depends on the previous result.
      // eslint-disable-next-line no-await-in-loop
      const job = await getDataSourceUploadJob(jobId);

      patchRow(rowId, {
        job,
        phase:
          job.outcome === "running"
            ? "polling"
            : job.outcome === "succeeded"
              ? "done"
              : "failed",
        error: job.outcome === "failed" ? job.error : null,
      });

      if (job.outcome !== "running") {
        return;
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  async function uploadRow(row: UploadRow): Promise<void> {
    if (!row.file) {
      return;
    }

    const file = row.file;

    try {
      patchRow(row.id, { phase: "hashing", error: null });
      const sha256 = await sha256Hex(file);

      patchRow(row.id, { phase: "registering" });
      const { uploadId } = await registerDataSourceUpload(
        row.sourceKey,
        row.snapshotLabel,
        row.snapshotDate,
        file.size,
        sha256,
      );

      patchRow(row.id, { phase: "uploading" });
      const { jobId } = await uploadBlob(uploadId, file);

      void pollJob(row.id, jobId);
    } catch (error) {
      patchRow(row.id, {
        phase: "failed",
        error: actionErrorMessage(error),
      });
    }
  }

  async function submitAll(): Promise<void> {
    setIsSubmitting(true);

    try {
      for (const row of rows()) {
        if (row.file && row.phase === "idle") {
          // Uploads stay sequential; polling runs concurrently once queued.
          // eslint-disable-next-line no-await-in-loop
          await uploadRow(row);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    rows,
    isSubmitting,
    addRow,
    removeRow,
    setFile,
    setSourceKey,
    setSnapshotLabel,
    setSnapshotDate,
    submitAll,
  };
}

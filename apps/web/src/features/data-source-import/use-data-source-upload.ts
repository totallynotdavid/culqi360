import { createStore } from "solid-js";

import { actionErrorMessage } from "~/contracts/errors";
import { registerDataSourceUpload } from "~/rpc/data-sources/ingest";

/**
 * Phases this browser is responsible for. Once the blob is accepted the engine
 * owns the work, the server follows it, and the row reads its state from the job
 * subscription instead of from anything here.
 */
export type UploadRowPhase =
  | "idle"
  | "hashing"
  | "registering"
  | "uploading"
  | "tracking"
  | "failed";

export interface UploadRow {
  id: string;
  file: File | null;
  sourceKey: string;
  snapshotLabel: string;
  snapshotDate: string;
  phase: UploadRowPhase;
  jobId: string | null;
  error: string | null;
}

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
    jobId: null,
    error: null,
  };
}

// WebCrypto has no incremental digest, so the file is read whole. Data-source
// dumps are the large files in this system; a streaming hash would need its own
// implementation.
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
    { method: "PUT", body: file },
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

  const rows = () => store.rows;

  const isSubmitting = () =>
    store.rows.some(
      (row) =>
        row.phase === "hashing" ||
        row.phase === "registering" ||
        row.phase === "uploading",
    );

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

      patchRow(row.id, { phase: "tracking", jobId });
    } catch (error) {
      patchRow(row.id, { phase: "failed", error: actionErrorMessage(error) });
    }
  }

  async function submitAll(): Promise<void> {
    for (const row of rows()) {
      if (row.file && row.phase === "idle") {
        // Sequential: each upload streams a whole file, and the engine gates on
        // one snapshot at a time anyway.
        // eslint-disable-next-line no-await-in-loop
        await uploadRow(row);
      }
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

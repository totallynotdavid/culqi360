import { fail, type DomainError } from "~/domain/errors";
import type { GpvSnapshotId, GpvSnapshotJobId, UserId } from "~/domain/ids";
import type { StoreFileDeps } from "~/server/files/service/contracts";
import { storeUploadedFile } from "~/server/files/service/store-uploaded-file";
import type { DatabaseExecutor } from "~/server/platform/database/executor";
import type { BlobStore } from "~/server/platform/files/blob-store";
import type { OperationContext } from "~/server/platform/operation/context";
import { Err, Ok, type Result } from "~/shared/result";

import { acceptGpvSnapshot } from "./accept";

export interface SubmitGpvSnapshotInput {
  file: {
    name: string;
    sizeBytes: number;
    stream: ReadableStream<Uint8Array>;
  };
  cutAt: Date;
  uploadedBy: UserId;
}

export interface SubmitGpvSnapshotDeps {
  db: DatabaseExecutor;
  files: StoreFileDeps & { storage: BlobStore };
}

export interface SubmittedGpvSnapshot {
  snapshotId: GpvSnapshotId;
  jobId: GpvSnapshotJobId | null;
  cutAt: Date;
  duplicate: boolean;
}

export async function submitGpvSnapshot(
  input: SubmitGpvSnapshotInput,
  deps: SubmitGpvSnapshotDeps,
  operation: OperationContext,
): Promise<Result<SubmittedGpvSnapshot, DomainError>> {
  const file = await storeUploadedFile(
    {
      actor: { userId: input.uploadedBy },
      operationAt: operation.operationAt,
    },
    {
      purpose: "merchant_gpv_snapshot",
      name: input.file.name,
      sizeBytes: input.file.sizeBytes,
      stream: input.file.stream,
    },
    deps.files,
  );
  if (!file.ok) {
    return file;
  }

  const accepted = await acceptGpvSnapshot(deps.db, {
    fileAssetId: file.value.id,
    contentSha256: file.value.sha256Hex,
    cutAt: input.cutAt,
    uploadedAt: operation.operationAt,
  });

  if (accepted.kind === "duplicate") {
    await deps.files.repo.assets.delete(file.value.id);
    await deps.files.storage.delete(file.value.storageKey);
  }

  if (accepted.kind === "stale") {
    await deps.files.repo.assets.delete(file.value.id);
    await deps.files.storage.delete(file.value.storageKey);

    return Err(
      fail("gpv_snapshot_superseded", {
        details: { activeCutAt: accepted.activeCutAt.toISOString() },
      }),
    );
  }

  return Ok({
    snapshotId: accepted.snapshotId,
    jobId: accepted.kind === "accepted" ? accepted.jobId : null,
    cutAt: input.cutAt,
    duplicate: accepted.kind === "duplicate",
  });
}

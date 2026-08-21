import type { UserId } from "~/domain/ids";
import type { BlobStore } from "~/server/platform/files/blob-store";

import type { createAssetsRepo } from "../repo/assets";
import type { createRateRevisionFilesRepo } from "../repo/rate-revision";
import type { createSalesRepo } from "../repo/sales";
import type { createTokensRepo } from "../repo/tokens";
import type { FilePurpose } from "../types";

export interface FileRepos {
  assets: ReturnType<typeof createAssetsRepo>;
  tokens: ReturnType<typeof createTokensRepo>;
  sales: ReturnType<typeof createSalesRepo>;
  rateRevision: ReturnType<typeof createRateRevisionFilesRepo>;
}

export interface FileOperationContext {
  actor: { userId: UserId };
  operationAt: Date;
}

export interface StoreUploadInput {
  purpose: FilePurpose;
  name: string;
  sizeBytes?: number;
  stream: ReadableStream<Uint8Array>;
}

export interface StoreGeneratedFileInput {
  purpose: FilePurpose;
  filename: string;
  bytes: Uint8Array;
}

export interface StoreFileDeps {
  repo: Pick<FileRepos, "assets">;
  storage: BlobStore;
}

export interface DownloadTokenDeps {
  repo: Pick<FileRepos, "tokens">;
}

export interface ExecuteDownloadDeps {
  repo: Pick<FileRepos, "tokens" | "assets">;
  storage: BlobStore;
}

import { createAssetsRepo } from "~/server/files/repo/assets";
import { createRateRevisionFilesRepo } from "~/server/files/repo/rate-revision";
import { createSalesRepo } from "~/server/files/repo/sales";
import { createTokensRepo } from "~/server/files/repo/tokens";
import type { FileRepos } from "~/server/files/service/contracts";
import { executeDownload } from "~/server/files/service/execute-download";
import { createFileStorage } from "~/server/files/storage";
import type { UploadsConfig } from "~/server/platform/config/env";
import type { BlobStore } from "~/server/platform/files/blob-store";
import type { ServerInfrastructure } from "~/server/platform/infrastructure";
import type { OperationContext } from "~/server/platform/operation/context";

export type FilesRuntime = {
  repo: FileRepos;
  storage: BlobStore;
  download: (
    token: Parameters<typeof executeDownload>[0],
    operation: OperationContext,
  ) => ReturnType<typeof executeDownload>;
};

export function createFilesRuntime(
  serverInfrastructure: ServerInfrastructure,
  config: UploadsConfig,
): FilesRuntime {
  const repo: FileRepos = {
    assets: createAssetsRepo(serverInfrastructure.db),
    tokens: createTokensRepo(serverInfrastructure.db),
    sales: createSalesRepo(serverInfrastructure.db),
    rateRevision: createRateRevisionFilesRepo(serverInfrastructure.db),
  };

  const storage = createFileStorage(config.storageRoot);

  return {
    repo,
    storage,
    download: (token, operation) =>
      executeDownload(token, { repo, storage }, operation),
  };
}

import type { BookFilter } from "~/contracts/merchant-stats/views";
import type { DomainError } from "~/domain/errors";
import type {
  FileOperationContext,
  FileRepos,
} from "~/server/files/service/contracts";
import { issueDownloadToken } from "~/server/files/service/issue-download-token";
import { storeGeneratedFile } from "~/server/files/service/store-generated-file";
import type { DatabaseExecutor } from "~/server/platform/database/executor";
import type { BlobStore } from "~/server/platform/files/blob-store";
import type { Result } from "~/shared/result";

import { getCohortRows } from "../read/cohort";
import { getActiveGpvSnapshotCut } from "../read/latest-report";
import { buildMerchantGpvWorkbook } from "./workbook";

type ExportDeps = {
  db: DatabaseExecutor;
  filesRepo: FileRepos;
  filesStorage: BlobStore;
};

export async function requestMerchantGpvExport(
  ctx: FileOperationContext,
  filter: BookFilter,
  deps: ExportDeps,
): Promise<Result<{ token: string }, DomainError>> {
  const [rows, cutAt] = await Promise.all([
    getCohortRows(deps.db, filter),
    getActiveGpvSnapshotCut(deps.db),
  ]);
  const bytes = buildMerchantGpvWorkbook(rows);
  const storedFile = await storeGeneratedFile(
    ctx,
    {
      purpose: "merchant_gpv_export",
      filename: exportFilename(cutAt ?? ctx.operationAt),
      bytes,
    },
    { repo: deps.filesRepo, storage: deps.filesStorage },
  );

  if (!storedFile.ok) {
    return storedFile;
  }

  return issueDownloadToken(ctx, storedFile.value.id, { repo: deps.filesRepo });
}

function exportFilename(cutAt: Date): string {
  const day = String(cutAt.getUTCDate()).padStart(2, "0");
  const month = String(cutAt.getUTCMonth() + 1).padStart(2, "0");
  const year = cutAt.getUTCFullYear();
  return `GPV AL ${day}-${month}-${year}.xlsx`;
}

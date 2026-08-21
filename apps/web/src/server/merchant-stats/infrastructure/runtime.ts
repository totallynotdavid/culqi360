import type { CommissionManagerView } from "~/contracts/merchant-stats/commission-views";
import type {
  BookFilter,
  CohortSaleRow,
  FilterOptions,
  GpvCulqiView,
  GpvPerformanceView,
  Page,
  PublishedPage,
  QualityRow,
} from "~/contracts/merchant-stats/views";
import type { QualityIssue } from "~/contracts/merchant-stats/vocabulary";
import type { DomainError } from "~/domain/errors";
import type { GpvSnapshotId, GpvSnapshotIssueId, UserId } from "~/domain/ids";
import type { CommissionSchemeRules } from "~/domain/merchant-stats/commission";
import type { GpvSnapshotIssueResolution } from "~/domain/merchant-stats/snapshot";
import { appCalendarDateAt } from "~/domain/time/app-time";
import type {
  FileOperationContext,
  FileRepos,
} from "~/server/files/service/contracts";
import { createGpvSnapshotQueue } from "~/server/merchant-stats/snapshot/queue";
import { createGpvSnapshotJobRepo } from "~/server/merchant-stats/snapshot/repo";
import type { DatabaseExecutor } from "~/server/platform/database/executor";
import type { BlobStore } from "~/server/platform/files/blob-store";
import type { OperationContext } from "~/server/platform/operation/context";
import type { Result } from "~/shared/result";

import {
  setCommissionScheme,
  type SetCommissionSchemeInput,
} from "../commands/set-commission-scheme";
import { setTarget, type SetTargetInput } from "../commands/set-target";
import { getCommissionSchemeAsOf } from "../commission/scheme-repo";
import { getCommissionManagerView } from "../commission/ui/manager-view";
import {
  adjustMerchantMonthCredit,
  type AdjustMerchantMonthCreditInput,
} from "../credit/adjust";
import { requestMerchantGpvExport } from "../export/request-export";
import { getCohortRows } from "../read/cohort";
import {
  getGpvCulqiView,
  getGpvPerformanceView,
} from "../read/dashboard-views";
import { loadExecutiveGpvProgress } from "../read/executive-portfolio";
import { getFilterOptions } from "../read/options";
import { readPublishedGpvPage } from "../read/published-page";
import { getQualityRows } from "../read/quality";
import { getMerchantStatsForViewer } from "../read/ruc-stats";
import { getGpvSnapshotDetail } from "../read/snapshot-detail";
import { buildGpvSnapshotJobEvent } from "../snapshot/progress";
import { resolveGpvSnapshotIssue } from "../snapshot/resolve-issue";
import { submitGpvSnapshot } from "../snapshot/submit";

interface MerchantStatsRuntimeDeps {
  db: DatabaseExecutor;
  files: {
    repo: FileRepos;
    storage: BlobStore;
  };
}

export function createMerchantStatsRuntime(deps: MerchantStatsRuntimeDeps) {
  const jobs = createGpvSnapshotJobRepo(deps.db);

  return {
    dashboard: {
      performance: (
        filter: BookFilter,
        operation: OperationContext,
      ): Promise<GpvPerformanceView> =>
        getGpvPerformanceView(deps.db, filter, operation),
      culqi: (filter: BookFilter): Promise<GpvCulqiView> =>
        getGpvCulqiView(deps.db, filter),
      cohorts: (
        filter: BookFilter,
        page: Page,
      ): Promise<PublishedPage<CohortSaleRow>> =>
        readPublishedGpvPage(deps.db, (transaction) =>
          getCohortRows(transaction, filter, page),
        ),
      filterOptions: (): Promise<FilterOptions> => getFilterOptions(deps.db),
      export: (ctx: FileOperationContext, filter: BookFilter) =>
        requestMerchantGpvExport(ctx, filter, {
          db: deps.db,
          filesRepo: deps.files.repo,
          filesStorage: deps.files.storage,
        }),
    },
    executive: {
      progress: (userId: UserId, operation: OperationContext) =>
        loadExecutiveGpvProgress(deps.db, userId, operation),
      rucStats: getMerchantStatsForViewer.bind(null, deps.db),
    },
    quality: {
      rows: (
        issue: QualityIssue,
        page: Page,
      ): Promise<PublishedPage<QualityRow>> =>
        readPublishedGpvPage(deps.db, (transaction) =>
          getQualityRows(transaction, issue, page),
        ),
    },
    attribution: {
      adjust: (
        input: Omit<AdjustMerchantMonthCreditInput, "operation">,
        operation: OperationContext,
      ): Promise<Result<void, DomainError>> =>
        adjustMerchantMonthCredit(deps.db, { ...input, operation }),
      setTarget: (
        input: Omit<SetTargetInput, "operation">,
        operation: OperationContext,
      ): Promise<Result<void, DomainError>> =>
        setTarget(deps.db, { ...input, operation }),
    },
    commission: {
      getScheme: (
        operation: OperationContext,
      ): Promise<CommissionSchemeRules> =>
        getCommissionSchemeAsOf(
          deps.db,
          appCalendarDateAt(operation.operationAt),
        ),
      setScheme: (
        input: Omit<SetCommissionSchemeInput, "operation">,
        operation: OperationContext,
      ): Promise<Result<void, DomainError>> =>
        setCommissionScheme(deps.db, { ...input, operation }),
      managerView: (
        operation: OperationContext,
      ): Promise<CommissionManagerView> =>
        getCommissionManagerView(deps.db, operation),
    },
    imports: {
      submit: (
        input: Parameters<typeof submitGpvSnapshot>[0],
        operation: OperationContext,
      ) =>
        submitGpvSnapshot(input, { db: deps.db, files: deps.files }, operation),
      jobEvent: async (snapshotId: GpvSnapshotId) => {
        const job = await jobs.findBySnapshotId(snapshotId);

        return job ? buildGpvSnapshotJobEvent(job) : null;
      },
      snapshot: (snapshotId: GpvSnapshotId) =>
        getGpvSnapshotDetail(deps.db, snapshotId),
      resolveIssue: (
        input: {
          issueId: GpvSnapshotIssueId;
          resolution: GpvSnapshotIssueResolution;
          resolvedBy: UserId;
        },
        operation: OperationContext,
      ) => resolveGpvSnapshotIssue(deps.db, { ...input, operation }),
      createQueue: (workerId: string) =>
        createGpvSnapshotQueue(workerId, {
          db: deps.db,
          readFile: (storageKey) => deps.files.storage.getBytes(storageKey),
        }),
    },
  };
}

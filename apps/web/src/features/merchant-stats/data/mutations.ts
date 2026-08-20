import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import {
  adjustMonthCredit,
  setMerchantTarget,
} from "~/rpc/merchant-stats/attribution";
import {
  commissionManagerDashboardQuery,
  commissionSchemeDraftQuery,
  setCommissionScheme,
} from "~/rpc/merchant-stats/commission-scheme";
import { requestMerchantGpvExportDownloadToken } from "~/rpc/merchant-stats/dashboard";
import { gpvSnapshotQuery } from "~/rpc/merchant-stats/gpv-snapshot";
import {
  resolveGpvImportIssue,
  uploadMerchantReport,
} from "~/rpc/merchant-stats/imports";
import { merchantFilterOptionsQuery } from "~/rpc/merchant-stats/merchant-filter-options";

import {
  ATTRIBUTION_GPV_QUERY_KEYS,
  PUBLISHED_GPV_QUERY_KEYS,
} from "./revalidation";

export const adjustMonthCreditMutation = action(
  async (input: Parameters<typeof adjustMonthCredit>[0]) => {
    const result = await adjustMonthCredit(input);

    return respond(result, {
      revalidate: [
        ...ATTRIBUTION_GPV_QUERY_KEYS,
        merchantFilterOptionsQuery.key,
      ],
    });
  },
  "adjustMerchantMonthCredit",
);

export const setMerchantTargetMutation = action(
  async (input: Parameters<typeof setMerchantTarget>[0]) => {
    const result = await setMerchantTarget(input);

    return respond(result, { revalidate: ATTRIBUTION_GPV_QUERY_KEYS });
  },
  "setMerchantGpvTarget",
);

export const setCommissionSchemeMutation = action(
  async (input: Parameters<typeof setCommissionScheme>[0]) => {
    const result = await setCommissionScheme(input);

    return respond(result, {
      revalidate: [
        commissionSchemeDraftQuery.key,
        commissionManagerDashboardQuery.key,
      ],
    });
  },
  "setCommissionScheme",
);

export const uploadMerchantReportMutation = action(
  uploadMerchantReport,
  "uploadMerchantGpvReport",
);

export const resolveGpvImportIssueMutation = action(
  async (input: Parameters<typeof resolveGpvImportIssue>[0]) => {
    const result = await resolveGpvImportIssue(input);
    const revalidate = [gpvSnapshotQuery.key];

    if (result.activated) {
      revalidate.push(...PUBLISHED_GPV_QUERY_KEYS);
    }

    return respond(result, { revalidate });
  },
  "resolveMerchantGpvImportIssue",
);

export const requestMerchantGpvExportMutation = action(
  requestMerchantGpvExportDownloadToken,
  "requestMerchantGpvExport",
);

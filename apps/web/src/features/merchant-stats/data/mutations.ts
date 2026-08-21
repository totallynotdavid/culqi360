import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import {
  ATTRIBUTED_GPV_KEYS,
  PUBLISHED_GPV_KEYS,
  QUERY_KEYS,
} from "~/contracts/query-keys";
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
import {
  resolveGpvImportIssue,
  uploadMerchantReport,
} from "~/rpc/merchant-stats/imports";

export const adjustMonthCreditMutation = action(
  async (input: Parameters<typeof adjustMonthCredit>[0]) => {
    const result = await adjustMonthCredit(input);

    return respond(result, {
      revalidate: [
        ...ATTRIBUTED_GPV_KEYS,
        QUERY_KEYS.merchantStats.filterOptions,
      ],
    });
  },
  "adjustMerchantMonthCredit",
);

export const setMerchantTargetMutation = action(
  async (input: Parameters<typeof setMerchantTarget>[0]) => {
    const result = await setMerchantTarget(input);

    return respond(result, { revalidate: [...ATTRIBUTED_GPV_KEYS] });
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
    const revalidate: string[] = [QUERY_KEYS.merchantStats.gpvSnapshot];

    if (result.activated) {
      revalidate.push(...PUBLISHED_GPV_KEYS);
    }

    return respond(result, { revalidate });
  },
  "resolveMerchantGpvImportIssue",
);

export const requestMerchantGpvExportMutation = action(
  requestMerchantGpvExportDownloadToken,
  "requestMerchantGpvExport",
);

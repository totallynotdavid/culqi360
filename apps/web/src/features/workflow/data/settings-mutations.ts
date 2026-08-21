import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import { pendingQuotationPolicyQuery } from "~/rpc/workflow/pending-quotation-policy";
import { rateProposalPolicyQuery } from "~/rpc/workflow/rate-proposal-policy";
import {
  savePendingQuotationPolicy,
  type SavePendingQuotationPolicyInput,
} from "~/rpc/workflow/settings/pending-quotation-policy";
import { saveRateProposalPolicy } from "~/rpc/workflow/settings/rate-proposal-policy";

export const updateRateProposalPolicyMutation = action(
  async (input: { validityDays: number }) => {
    const result = await saveRateProposalPolicy(input);
    return respond(result, {
      revalidate: [rateProposalPolicyQuery.key],
    });
  },
  "workflow.updateRateProposalPolicy",
);

export const updatePendingQuotationPolicyMutation = action(
  async (input: SavePendingQuotationPolicyInput) => {
    const result = await savePendingQuotationPolicy(input);
    return respond(result, {
      revalidate: [pendingQuotationPolicyQuery.key],
    });
  },
  "workflow.updatePendingQuotationPolicy",
);

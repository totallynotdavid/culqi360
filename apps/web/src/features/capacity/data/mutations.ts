import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import {
  approveCapacity,
  grantMoreLeadRefill,
  grantMoreSearches,
  rejectCapacity,
} from "~/rpc/capacity/approvals";
import { capacityPolicyDefaultsQuery } from "~/rpc/capacity/capacity-policy-defaults";
import { executiveCapacityDetailQuery } from "~/rpc/capacity/executive-capacity-detail";
import { managedExecutivesQuery } from "~/rpc/capacity/managed-executives";
import { myContactAssignmentCapacityQuery } from "~/rpc/capacity/my-contact-assignment-capacity";
import { mySearchAllowanceQuery } from "~/rpc/capacity/my-search-allowance";
import { pendingCapacityRequestsQuery } from "~/rpc/capacity/pending-capacity-requests";
import {
  updateExecutivePolicyOverride,
  updateScopePolicy,
} from "~/rpc/capacity/policies";
import {
  requestMoreLeadRefill,
  requestMoreSearches,
} from "~/rpc/capacity/requests";

export const requestMoreSearchesMutation = action(
  async (amount: number, reason: string) => {
    const result = await requestMoreSearches(amount, reason);
    return respond(result, {
      revalidate: [
        mySearchAllowanceQuery.key,
        pendingCapacityRequestsQuery.key,
      ],
    });
  },
  "requestMoreSearches",
);

export const requestMoreLeadRefillMutation = action(
  async (amount: number, reason: string) => {
    const result = await requestMoreLeadRefill(amount, reason);
    return respond(result, {
      revalidate: [
        myContactAssignmentCapacityQuery.key,
        pendingCapacityRequestsQuery.key,
      ],
    });
  },
  "requestMoreLeadRefill",
);

export const approveCapacityRequestMutation = action(
  async (requestId: string, note?: string) => {
    const result = await approveCapacity(requestId, note);
    return respond(result, {
      revalidate: [
        pendingCapacityRequestsQuery.key,
        managedExecutivesQuery.key,
        executiveCapacityDetailQuery.key,
        mySearchAllowanceQuery.key,
        myContactAssignmentCapacityQuery.key,
      ],
    });
  },
  "approveCapacityRequest",
);

export const rejectCapacityRequestMutation = action(
  async (requestId: string, note: string) => {
    const result = await rejectCapacity(requestId, note);
    return respond(result, {
      revalidate: [
        pendingCapacityRequestsQuery.key,
        managedExecutivesQuery.key,
        executiveCapacityDetailQuery.key,
      ],
    });
  },
  "rejectCapacityRequest",
);

export const grantMoreSearchesMutation = action(
  async (userId: string, amount: number, reason: string) => {
    const result = await grantMoreSearches(userId, amount, reason);
    return respond(result, {
      revalidate: [
        managedExecutivesQuery.key,
        executiveCapacityDetailQuery.key,
        pendingCapacityRequestsQuery.key,
      ],
    });
  },
  "grantMoreSearches",
);

export const grantMoreLeadRefillMutation = action(
  async (userId: string, amount: number, reason: string) => {
    const result = await grantMoreLeadRefill(userId, amount, reason);
    return respond(result, {
      revalidate: [
        managedExecutivesQuery.key,
        executiveCapacityDetailQuery.key,
        pendingCapacityRequestsQuery.key,
      ],
    });
  },
  "grantMoreLeadRefill",
);

export const updateExecutivePolicyOverrideMutation = action(
  async (input: {
    userId: string;
    monthlySearchLimit: number;
    activeBufferTarget: number;
    dailyRefillLimit: number;
    expiresAt: number | null;
  }) => {
    const result = await updateExecutivePolicyOverride(input);
    return respond(result, {
      revalidate: [
        managedExecutivesQuery.key,
        executiveCapacityDetailQuery.key,
      ],
    });
  },
  "updateExecutivePolicyOverride",
);

export const updateScopePolicyMutation = action(
  async (input: {
    scopeType: "branch" | "team";
    scopeId: string;
    monthlySearchLimit: number;
    activeBufferTarget: number;
    dailyRefillLimit: number;
  }) => {
    const result = await updateScopePolicy(input);
    return respond(result, {
      revalidate: [capacityPolicyDefaultsQuery.key, managedExecutivesQuery.key],
    });
  },
  "updateScopePolicy",
);

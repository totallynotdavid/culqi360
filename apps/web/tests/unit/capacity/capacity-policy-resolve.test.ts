import { describe, expect, it } from "vitest";

import { CAPACITY_LIMITS } from "~/server/capacity/domain/config";
import {
  resolveLeadPolicy,
  resolveSearchPolicy,
} from "~/server/capacity/domain/policy";

const SEARCH_LIMITS = {
  user: { search_limit: 100 },
  team: { search_limit: 50 },
  branch: { search_limit: 25 },
};

const LEAD_LIMITS = {
  user: { active_buffer_target: 10, daily_refill_limit: 5 },
  team: { active_buffer_target: 8, daily_refill_limit: 4 },
  branch: { active_buffer_target: 6, daily_refill_limit: 3 },
};

describe("resolveSearchPolicy", () => {
  it.each([
    [
      "user",
      {
        userOverride: SEARCH_LIMITS.user,
        teamDefault: SEARCH_LIMITS.team,
        branchDefault: SEARCH_LIMITS.branch,
      },
      100,
    ],
    [
      "team",
      {
        userOverride: null,
        teamDefault: SEARCH_LIMITS.team,
        branchDefault: SEARCH_LIMITS.branch,
      },
      50,
    ],
    [
      "branch",
      {
        userOverride: null,
        teamDefault: null,
        branchDefault: SEARCH_LIMITS.branch,
      },
      25,
    ],
    [
      "system",
      { userOverride: null, teamDefault: null, branchDefault: null },
      CAPACITY_LIMITS.defaultSearchMonthly,
    ],
    ["system", {}, CAPACITY_LIMITS.defaultSearchMonthly],
  ])("resolves the %s source", (source, input, monthlyLimit) => {
    expect(resolveSearchPolicy(input)).toMatchObject({ source, monthlyLimit });
  });
});

describe("resolveLeadPolicy", () => {
  it.each([
    [
      "user",
      {
        userOverride: LEAD_LIMITS.user,
        teamDefault: LEAD_LIMITS.team,
        branchDefault: LEAD_LIMITS.branch,
      },
      10,
      5,
    ],
    [
      "team",
      {
        userOverride: null,
        teamDefault: LEAD_LIMITS.team,
        branchDefault: LEAD_LIMITS.branch,
      },
      8,
      4,
    ],
    [
      "branch",
      {
        userOverride: null,
        teamDefault: null,
        branchDefault: LEAD_LIMITS.branch,
      },
      6,
      3,
    ],
    [
      "system",
      { userOverride: null, teamDefault: null, branchDefault: null },
      CAPACITY_LIMITS.defaultLeadBuffer,
      CAPACITY_LIMITS.defaultDailyRefill,
    ],
    [
      "system",
      {},
      CAPACITY_LIMITS.defaultLeadBuffer,
      CAPACITY_LIMITS.defaultDailyRefill,
    ],
  ])("resolves the %s source", (source, input, bufferTarget, dailyLimit) => {
    expect(resolveLeadPolicy(input)).toMatchObject({
      source,
      bufferTarget,
      dailyLimit,
    });
  });
});

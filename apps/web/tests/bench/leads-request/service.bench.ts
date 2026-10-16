import { operationAt } from "@tests/support/operation";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { BranchId, UserId } from "~/domain/ids";
import { createContactAssignmentsRuntime } from "~/server/contact-assignments/runtime";

import { BENCH_NOW } from "../_shared/constants";
import { createBenchDbFixture } from "../_shared/fixture";
import { SINGLE_CALL } from "../_shared/options";
import { createLeadsBench, type LeadsBench } from "./fixtures";

describe("lead refill service benchmark", () => {
  const db = createBenchDbFixture("bench-leads-request-service");
  let branchId: BranchId;
  let seedUnit: LeadsBench["seedUnit"];
  let assignmentRuntime: ReturnType<typeof createContactAssignmentsRuntime>;
  let userId: UserId;

  beforeAll(async () => {
    const ctx = await db.setup();
    const leads = createLeadsBench(ctx);
    branchId = leads.branchId;
    seedUnit = leads.seedUnit;
    assignmentRuntime = createContactAssignmentsRuntime({
      executor: ctx.db,
      engine: leads.engine,
    });
  });

  afterAll(async () => {
    await db.teardown();
  });

  test("service path: request lead refill for one user", async ({ bench }) => {
    const result = await bench(
      "service path: request lead refill for one user",
      {
        beforeEach: async () => {
          userId = await seedUnit();
        },
      },
      async () => {
        const assignmentResult = await assignmentRuntime.assign(
          { actorUserId: userId, branchId },
          operationAt(BENCH_NOW),
        );

        if (!assignmentResult.ok) {
          throw new Error(
            `expected lead refill success, got ${assignmentResult.error.code}`,
          );
        }
      },
    ).run(SINGLE_CALL);
    expect(result.state).toBe("completed");
  });
});

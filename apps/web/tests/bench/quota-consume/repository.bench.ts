import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { UserId } from "~/domain/ids";
import { appMonthRange } from "~/domain/time/app-time";

import { BENCH_NOW } from "../_shared/constants";
import { createBenchDbFixture } from "../_shared/fixture";
import { seedQuotaUser } from "./fixtures";

describe("search capacity grant repository benchmark", () => {
  const db = createBenchDbFixture("bench-quota-consume-repository");
  const monthRange = appMonthRange(BENCH_NOW);

  let userId: UserId;

  beforeAll(async () => {
    const ctx = await db.setup();
    userId = await seedQuotaUser(ctx);

    // Fail fast if the benchmark seed is empty.
    const grants = await ctx.repos.searchCapacityGrants.findByUserAndRange(
      userId,
      monthRange,
    );
    if (grants.length === 0) {
      throw new Error("expected at least one search capacity grant row");
    }
  });

  afterAll(async () => {
    await db.teardown();
  });

  test("repository path: load search capacity grants by user and period", async ({
    bench,
  }) => {
    const result =
      await bench("repository path: load search capacity grants by user and period", async () => {
        const repo = db.ctx().repos.searchCapacityGrants;
        await repo.findByUserAndRange(userId, monthRange);
      }).run();
    expect(result.state).toBe("completed");
  });
});

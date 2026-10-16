import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  createRecipientPlanner,
  projectIntentForPlanning,
} from "~/server/notifications/expansion/plan-recipients";
import { createLogger } from "~/shared/observability/runtime-logger";
import { isErr } from "~/shared/result";

import { BENCH_NOW } from "../_shared/constants";
import { createBenchDbFixture } from "../_shared/fixture";
import {
  PLANNER_SCENARIOS,
  type PlannerEntry,
  type PlannerScenarioName,
  seedPlannerEntries,
} from "./fixtures";

describe("notifications delivery planner benchmark", () => {
  const db = createBenchDbFixture("bench-notifications-delivery-planner");
  let planRecipients: ReturnType<typeof createRecipientPlanner>;
  let entries: Record<PlannerScenarioName, PlannerEntry>;

  beforeAll(async () => {
    const ctx = await db.setup();
    planRecipients = createRecipientPlanner(
      ctx.db,
      createLogger("bench-notification-planner"),
    );
    entries = await seedPlannerEntries(ctx);
  });

  afterAll(async () => {
    await db.teardown();
  });

  for (const scenario of PLANNER_SCENARIOS) {
    test(`service path: plan deliveries (${scenario.name})`, async ({
      bench,
    }) => {
      const result =
        await bench(`service path: plan deliveries (${scenario.name})`, async () => {
          const input = projectIntentForPlanning(entries[scenario.name]);
          if (isErr(input)) {
            throw new Error(input.error);
          }
          await planRecipients(input.value, BENCH_NOW);
        }).run();
      expect(result.state).toBe("completed");
    });
  }
});

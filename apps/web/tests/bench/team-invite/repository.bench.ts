import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { BENCH_NOW } from "../_shared/constants";
import { createBenchDbFixture } from "../_shared/fixture";
import { seedPendingInvite } from "./fixtures";

describe("team invite repository benchmark", () => {
  const db = createBenchDbFixture("bench-team-invite-repository");
  let token: string;

  beforeAll(async () => {
    const ctx = await db.setup();
    token = (await seedPendingInvite(ctx)).token;
  });

  afterAll(async () => {
    await db.teardown();
  });

  test("repository path: load pending invite by token", async ({ bench }) => {
    const result =
      await bench("repository path: load pending invite by token", async () => {
        const row = await db
          .ctx()
          .repos.userInvites.findPendingByToken(token, BENCH_NOW);
        if (!row) {
          throw new Error("expected pending invite row for token");
        }
      }).run();
    expect(result.state).toBe("completed");
  });
});

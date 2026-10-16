import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { UserId } from "~/domain/ids";

import { createBenchDbFixture } from "../_shared/fixture";
import { SINGLE_CALL } from "../_shared/options";
import { SESSIONS_PER_USER, seedBenchUser, setUserSessions } from "./fixtures";

describe("sessions.deleteAllForUser", () => {
  const db = createBenchDbFixture("bench-session-delete");
  let userId: UserId;

  beforeAll(async () => {
    const ctx = await db.setup();
    userId = await seedBenchUser(ctx);
  });

  afterAll(async () => {
    await db.teardown();
  });

  test("delete all sessions for a heavy user", async ({ bench }) => {
    const result = await bench(
      "delete all sessions for a heavy user",
      {
        beforeEach: async () => {
          await setUserSessions(db.ctx(), userId, SESSIONS_PER_USER);
        },
      },
      async () => {
        await db.ctx().repos.sessions.deleteAllForUser(userId);
      },
    ).run(SINGLE_CALL);
    expect(result.state).toBe("completed");
  });
});

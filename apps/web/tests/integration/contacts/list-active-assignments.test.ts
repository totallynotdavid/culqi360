import { operationAt } from "@tests/support/operation";
import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  TEST_FIXTURES,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createContactAssignmentsRuntime } from "~/server/contact-assignments/runtime";
import { Ok } from "~/shared/result";

const ACTOR_ID = TEST_FIXTURES.users.execOne.id;
const OTHER_USER_ID = TEST_FIXTURES.users.execTwo.id;
const NOW = new Date("2026-08-07T17:00:00.000Z");
const HOUR_MS = 3_600_000;

describe("listActive", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestDb("list-active-assignments");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  function runtime() {
    return createContactAssignmentsRuntime({
      executor: ctx.db,
      engine: { requestCandidates: async () => Ok([]) },
    });
  }

  async function assignTo(
    userId: typeof ACTOR_ID,
    expiresAt: Date,
  ): Promise<string> {
    const id = crypto.randomUUID();
    await ctx.db
      .insertInto("contact_assignments")
      .values({
        id,
        user_id: userId,
        contact_id: TEST_FIXTURES.organizationPeople.lima.id,
        assigned_at: new Date(NOW.getTime() - HOUR_MS),
        expires_at: expiresAt,
        status: "active",
      })
      .execute();
    return id;
  }

  it("lists only the actor's unexpired assignments with the contact's name and phone", async () => {
    const mine = await assignTo(ACTOR_ID, new Date(NOW.getTime() + HOUR_MS));
    await assignTo(ACTOR_ID, new Date(NOW.getTime() - 1));
    await assignTo(OTHER_USER_ID, new Date(NOW.getTime() + HOUR_MS));

    const result = await runtime().listActive(ACTOR_ID, operationAt(NOW));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      assignmentId: mine,
      contactId: TEST_FIXTURES.organizationPeople.lima.id,
      expiresAt: NOW.getTime() + HOUR_MS,
    });
    expect(result.value[0]?.name).not.toBe("");
  });
});

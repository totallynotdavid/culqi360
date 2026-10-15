import { expectErr } from "@tests/support/_core/assertions";
import { createExtensionScenario } from "@tests/support/extension/api";
import { createExtensionFixture } from "@tests/support/extension/fixture";
import { operationAt } from "@tests/support/operation";
import {
  cleanupTestDb,
  resetTestDb,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("extension session revocation after the web login ended", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createExtensionFixture("extension-session-revocation");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  it("keeps the installation session revoked and flags reauth after rejecting an event", async () => {
    const scenario = createExtensionScenario(ctx);
    const { sessionToken, authSessionId } = await scenario.claim(
      "11111111-1111-4111-8111-111111111111",
    );
    await ctx.db
      .updateTable("user_sessions")
      .set({ expires_at: new Date(Date.now() - 1000) })
      .where("id", "=", authSessionId)
      .execute();

    const error = expectErr(
      await scenario.service.ingestRuntimeEvent(
        {
          sessionToken,
          event: {
            id: "evt-after-logout",
            sequence: 1,
            type: "executive.heartbeat",
            createdAt: Date.now(),
            payload: { occurredAt: Date.now() },
          },
        },
        operationAt(new Date()),
      ),
    );

    expect(error.code).toBe("extension_session_invalid");
    const sessions = await ctx.db
      .selectFrom("extension_installation_sessions")
      .select("revoked_at")
      .execute();
    expect(sessions.map((row) => row.revoked_at)).not.toContain(null);
    const status = await ctx.db
      .selectFrom("extension_executive_statuses")
      .select("sync_health")
      .executeTakeFirstOrThrow();
    expect(status.sync_health).toBe("reauth_required");
  });
});

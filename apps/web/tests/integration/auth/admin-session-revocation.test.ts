import { getSeededIdentity } from "@tests/support/identities/api";
import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { makeAppContext, makeAuthSession } from "@tests/support/unit/factories";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { InstallationId } from "~/domain/ids";
import { revokeAllUserSessions } from "~/server/auth/flows/revoke-all-user-sessions";
import { revokeUserSession } from "~/server/auth/flows/revoke-user-session";
import { createAccessSecurityContext } from "~/server/auth/infrastructure/session-revocation-context";
import type { AppContext } from "~/server/platform/action/context";

const ADMIN = getSeededIdentity("superuser");
const TARGET = getSeededIdentity("execOne");
const NOW = new Date("2026-07-15T12:00:00.000Z");

function makeAdminContext(): AppContext {
  return makeAppContext({
    actor: makeAuthSession({
      id: "admin-session",
      userId: ADMIN.userId,
      role: "superuser",
      branchId: ADMIN.branchId,
      strongAuthMethod: "totp",
      strongAuthAt: NOW,
    }),
    requestId: "req-test",
    traceId: "trace-test",
    userAgent: null,
    operationAt: NOW,
  });
}

describe("admin session revocation", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestDb("admin-session-revocation");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  function makeSecurityContext() {
    return createAccessSecurityContext(ctx.db);
  }

  async function seedSession(sessionId: string) {
    await ctx.repos.sessions.create({
      id: sessionId,
      user_id: TARGET.userId,
      branch_id: TARGET.branchId,
      role: TARGET.role,
      session_class: "app",
      primary_auth_method: "password",
      strong_auth_method: null,
      strong_auth_at: null,
      impersonator_user_id: null,
      ip_address: "198.51.100.10",
      user_agent: "vitest",
      created_at: NOW,
      last_activity: NOW,
      expires_at: new Date(NOW.getTime() + 60 * 60 * 1000),
    });
  }

  async function seedExecutiveStatus() {
    await ctx.db
      .insertInto("extension_executive_statuses")
      .values({
        user_id: TARGET.userId,
        branch_id: TARGET.branchId,
        assignment_id: null,
        contact_id: null,
        call_session_id: null,
        presence_status: null,
        presence_updated_at: null,
        sync_health: "ok",
        sync_updated_at: null,
        source_event_id: null,
        source_event_sequence: null,
      })
      .execute();
  }

  async function seedInstallationSession(sessionId: string) {
    await ctx.repos.extensionRuntime.createInstallationSession({
      jti: crypto.randomUUID(),
      user_id: TARGET.userId,
      branch_id: TARGET.branchId,
      auth_session_id: sessionId,
      installation_id: InstallationId.trust(crypto.randomUUID()),
      refresh_token_hash: `hash-${crypto.randomUUID()}`,
      issued_at: NOW,
      expires_at: new Date(NOW.getTime() + 60 * 60 * 1000),
    });
  }

  it("revokes a single session, clears its installation, flips sync health, and audits the action", async () => {
    const sessionId = "sess-single-revoke";

    await seedSession(sessionId);
    await seedExecutiveStatus();
    await seedInstallationSession(sessionId);

    const result = await revokeUserSession(
      makeAdminContext(),
      makeSecurityContext(),
      {
        sessionId,
        targetUserId: TARGET.userId,
      },
    );

    expect(result.ok).toBe(true);
    expect(await ctx.repos.sessions.findById(sessionId)).toBeNull();

    const installation = await ctx.db
      .selectFrom("extension_installation_sessions")
      .selectAll()
      .where("auth_session_id", "=", sessionId)
      .executeTakeFirstOrThrow();

    expect(installation.revoked_at).not.toBeNull();

    const status = await ctx.db
      .selectFrom("extension_executive_statuses")
      .selectAll()
      .where("user_id", "=", TARGET.userId)
      .executeTakeFirstOrThrow();

    expect(status.sync_health).toBe("reauth_required");
    expect(status.sync_updated_at).toEqual(NOW);

    const event = await ctx.db
      .selectFrom("events")
      .selectAll()
      .where("entity_type", "=", "user_session")
      .where("entity_id", "=", sessionId)
      .executeTakeFirst();

    expect(event).toMatchObject({
      type: "session_revoked_by_admin",
      actor_user_id: ADMIN.userId,
    });
    expect(event?.payload_json).toEqual({
      targetUserId: TARGET.userId,
      revokedBy: ADMIN.userId,
    });
  });

  it("revokes every session for a user, clears every installation, and audits once", async () => {
    const sessionOne = "sess-all-one";
    const sessionTwo = "sess-all-two";

    await seedSession(sessionOne);
    await seedSession(sessionTwo);
    await seedExecutiveStatus();
    await seedInstallationSession(sessionOne);
    await seedInstallationSession(sessionTwo);

    const result = await revokeAllUserSessions(
      makeAdminContext(),
      makeSecurityContext(),
      {
        targetUserId: TARGET.userId,
      },
    );

    expect(result.ok).toBe(true);
    expect(await ctx.repos.sessions.findById(sessionOne)).toBeNull();
    expect(await ctx.repos.sessions.findById(sessionTwo)).toBeNull();

    const installations = await ctx.db
      .selectFrom("extension_installation_sessions")
      .selectAll()
      .where("user_id", "=", TARGET.userId)
      .execute();

    expect(installations).toHaveLength(2);
    expect(installations.every((row) => row.revoked_at !== null)).toBe(true);

    const status = await ctx.db
      .selectFrom("extension_executive_statuses")
      .selectAll()
      .where("user_id", "=", TARGET.userId)
      .executeTakeFirstOrThrow();

    expect(status.sync_health).toBe("reauth_required");

    const events = await ctx.db
      .selectFrom("events")
      .selectAll()
      .where("entity_type", "=", "user")
      .where("entity_id", "=", TARGET.userId)
      .execute();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "all_sessions_revoked",
      actor_user_id: ADMIN.userId,
    });
    expect(events[0]?.payload_json).toEqual({
      revokedBy: ADMIN.userId,
    });
  });
});

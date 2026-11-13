import { expectErr, expectOk } from "@tests/support/_core/assertions";
import { getSeededIdentity } from "@tests/support/identities/api";
import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { makeAppContext, makeAuthSession } from "@tests/support/unit/factories";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Role } from "~/domain/auth/access/rbac";
import type { UserId } from "~/domain/ids";
import { hashPasswordResetToken } from "~/server/auth/password/reset-tokens";
import type { AppContext } from "~/server/platform/action/context";
import { generateMemberResetLink } from "~/server/users/application/use-cases/generate-member-reset-link";
import { createMemberWriteContext } from "~/server/users/infrastructure/member-write-context";

const ADMIN = getSeededIdentity("superuser");
const TARGET = getSeededIdentity("execTwo");
const OUT_OF_BRANCH = getSeededIdentity("execOne");
const NOW = new Date("2026-07-15T12:00:00.000Z");

const CONFIGURED_ORIGIN = "https://crm.example.test";

function makeContext(overrides: {
  userId: UserId;
  role: Role;
  branchId: AppContext["actor"]["branchId"];
}): AppContext {
  return makeAppContext({
    actor: makeAuthSession({
      id: "actor-session",
      userId: overrides.userId,
      role: overrides.role,
      branchId: overrides.branchId,
    }),
    operationAt: NOW,
    publicOrigin: "http://proxy.internal",
  });
}

function writeDeps(db: TestDbContext["db"]) {
  return {
    ...createMemberWriteContext(db),
    publicOrigin: CONFIGURED_ORIGIN,
  };
}

function tokenFrom(resetUrl: string): string {
  const token = resetUrl.split("token=")[1];
  if (!token) {
    throw new Error(`no token in ${resetUrl}`);
  }
  return token;
}

describe("generateMemberResetLink", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestDb("member-reset-link");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  async function tokensFor(userId: UserId) {
    return ctx.db
      .selectFrom("password_reset_tokens")
      .selectAll()
      .where("user_id", "=", userId)
      .execute();
  }

  it.each([
    {
      name: "role that cannot manage members",
      actor: makeContext({
        userId: TARGET.userId,
        role: "executive",
        branchId: TARGET.branchId,
      }),
      target: getSeededIdentity("backTwo"),
      code: "cannot_manage_member",
    },
    {
      name: "member in another branch",
      actor: makeContext({
        userId: ADMIN.userId,
        role: "superuser",
        branchId: ADMIN.branchId,
      }),
      target: OUT_OF_BRANCH,
      code: "user_not_found",
    },
    {
      name: "themselves",
      actor: makeContext({
        userId: ADMIN.userId,
        role: "superuser",
        branchId: ADMIN.branchId,
      }),
      target: ADMIN,
      code: "cannot_manage_self",
    },
  ])("rejects an actor targeting $name", async ({ actor, target, code }) => {
    const result = await generateMemberResetLink(
      actor,
      writeDeps(ctx.db),
      target.userId,
    );

    expect(expectErr(result)).toMatchObject({ code });
    expect(await tokensFor(target.userId)).toHaveLength(0);
  });

  it("stores the token hashed, returns the link once, and audits without the secret", async () => {
    const value = expectOk(
      await generateMemberResetLink(
        makeContext({
          userId: ADMIN.userId,
          role: "superuser",
          branchId: ADMIN.branchId,
        }),
        writeDeps(ctx.db),
        TARGET.userId,
      ),
    );

    expect(value.resetUrl).toMatch(
      /^https:\/\/crm\.example\.test\/reset-password\?token=[a-z2-7]{32}$/,
    );
    const token = tokenFrom(value.resetUrl);
    const tokenHash = hashPasswordResetToken(token);

    const rows = await tokensFor(TARGET.userId);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) {
      throw new Error("expected a stored reset token");
    }
    expect(row.token_hash).toBe(tokenHash);
    expect(row.token_hash).not.toBe(token);
    expect(row.expires_at).toEqual(new Date(NOW.getTime() + 60 * 60 * 1000));
    expect(
      await ctx.repos.passwordResetTokens.findValidByHash(tokenHash, NOW),
    ).toBeTruthy();

    const event = await ctx.db
      .selectFrom("events")
      .selectAll()
      .where("type", "=", "password_reset_link_generated")
      .executeTakeFirstOrThrow();

    expect(event).toMatchObject({
      entity_type: "user",
      entity_id: TARGET.userId,
      actor_user_id: ADMIN.userId,
      subject_user_id: TARGET.userId,
    });
    expect(JSON.stringify(event)).not.toContain(token);
    expect(JSON.stringify(event)).not.toContain(value.resetUrl);
  });

  it("expires the member's earlier link when a new one is generated", async () => {
    const actor = makeContext({
      userId: ADMIN.userId,
      role: "superuser",
      branchId: ADMIN.branchId,
    });

    const first = expectOk(
      await generateMemberResetLink(actor, writeDeps(ctx.db), TARGET.userId),
    );
    const second = expectOk(
      await generateMemberResetLink(actor, writeDeps(ctx.db), TARGET.userId),
    );

    const firstHash = hashPasswordResetToken(tokenFrom(first.resetUrl));
    const secondHash = hashPasswordResetToken(tokenFrom(second.resetUrl));

    expect(
      await ctx.repos.passwordResetTokens.findValidByHash(firstHash, NOW),
    ).toBeUndefined();
    expect(
      await ctx.repos.passwordResetTokens.findValidByHash(secondHash, NOW),
    ).toBeTruthy();
  });
});

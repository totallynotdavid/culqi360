import {
  cleanupFreshDb,
  createFreshDb,
  type FreshDbContext,
} from "@tests/support/runtime/db";
import { sql } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { migrateToLatest } from "~/server/platform/database/migrate";

describe("schema baseline", () => {
  let ctx: FreshDbContext | null = null;

  afterEach(async () => {
    await cleanupFreshDb(ctx);
    ctx = null;
  });

  it("creates expected schema objects on a fresh database", async () => {
    ctx = await createFreshDb("schema-baseline-fresh");
    await migrateToLatest(ctx.db);

    const tables = await sql<{ tablename: string }>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `.execute(ctx.db);
    const tableNames = new Set(tables.rows.map((row) => row.tablename));
    expect(tableNames.has("users")).toBe(true);
    expect(tableNames.has("events")).toBe(true);
    expect(tableNames.has("audit_action_policies")).toBe(true);
    expect(tableNames.has("user_invites")).toBe(true);
    expect(tableNames.has("action_observations")).toBe(true);
    expect(tableNames.has("notification_intents")).toBe(true);
    expect(tableNames.has("login_flows")).toBe(true);

    const indexes = await sql<{ indexname: string }>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `.execute(ctx.db);
    const indexNames = new Set(indexes.rows.map((row) => row.indexname));
    expect(indexNames.has("idx_app_notifications_intent")).toBe(true);
    expect(indexNames.has("idx_events_occurred")).toBe(true);
    expect(indexNames.has("idx_events_type_occurred")).toBe(true);
    expect(indexNames.has("idx_events_actor_occurred")).toBe(true);
    expect(indexNames.has("idx_events_entity_occurred")).toBe(true);
    expect(indexNames.has("idx_audit_policy_risk_active")).toBe(true);
    expect(indexNames.has("idx_notification_intents_claim")).toBe(true);
  });

  it("is idempotent and maintains integrity hash", async () => {
    ctx = await createFreshDb("schema-baseline-rerun");
    await migrateToLatest(ctx.db);

    await ctx.db
      .insertInto("branches")
      .values({ name: "Lima", created_at: new Date() })
      .execute();

    await migrateToLatest(ctx.db);

    const branches = await ctx.db
      .selectFrom("branches")
      .select((eb) => eb.fn.count<number>("id").as("count"))
      .executeTakeFirstOrThrow();
    expect(branches.count).toBe(1);

    const integrity = await sql<{ migrations_hash: string }>`
      SELECT migrations_hash FROM schema_integrity
    `.execute(ctx.db);
    expect(integrity.rows.length).toBe(1);
    expect(integrity.rows[0]?.migrations_hash).toBeDefined();
  });
});

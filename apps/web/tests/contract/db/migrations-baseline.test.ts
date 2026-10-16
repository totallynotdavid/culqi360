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

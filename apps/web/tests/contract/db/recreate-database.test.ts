import {
  cleanupFreshDb,
  createFreshDb,
  databaseUrl,
  type FreshDbContext,
} from "@tests/support/runtime/db";
import { sql } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { createDb } from "~/server/platform/database/client";
import { migrateToLatest } from "~/server/platform/database/migrate";
import { recreateDatabase } from "~/server/platform/database/recreate";

describe("recreateDatabase", () => {
  let ctx: FreshDbContext | null = null;

  afterEach(async () => {
    await cleanupFreshDb(ctx);
    ctx = null;
  });

  it("replaces a database whose schema hash is stale with one that migrates", async () => {
    ctx = await createFreshDb("recreate-stale-hash");
    await migrateToLatest(ctx.db);
    await sql`UPDATE schema_integrity SET migrations_hash = 'stale'`.execute(
      ctx.db,
    );

    await expect(migrateToLatest(ctx.db)).rejects.toThrow("mise run db:reset");

    // The pool must be closed first: FORCE drops its sessions mid-flight.
    const { dbName } = ctx;
    await ctx.db.destroy();
    await recreateDatabase(databaseUrl(dbName));
    ctx = { ...ctx, db: createDb(() => databaseUrl(dbName)) };

    await expect(migrateToLatest(ctx.db)).resolves.toBeUndefined();
  });

  it("refuses the maintenance database", async () => {
    await expect(recreateDatabase(databaseUrl("postgres"))).rejects.toThrow(
      "maintenance database",
    );
  });

  it("refuses a name that is not a plain identifier", async () => {
    await expect(
      recreateDatabase(databaseUrl('x"; DROP DATABASE crm; --')),
    ).rejects.toThrow("unsafe name");
  });
});

import type { Kysely } from "kysely";

import { computeHash, readStoredHash, writeStoredHash } from "./migration-hash";
import { REFERENCE_DATA_MODULES, SCHEMA_MODULES } from "./schema";
import type { Database } from "./types";

export async function migrateToLatest(db: Kysely<Database>) {
  const hash = await computeHash(SCHEMA_MODULES, REFERENCE_DATA_MODULES);
  const stored = await readStoredHash(db);

  if (stored === hash) {
    await ensureSchemaBaselines(db);
    return;
  }
  if (stored !== null) {
    throw new Error(
      "Schema changed since the database was built.\n" +
        "  ⇢ Run `bun run db:reset` to rebuild the development database",
    );
  }

  await db.transaction().execute(async (trx) => {
    for (const module of SCHEMA_MODULES) {
      // eslint-disable-next-line no-await-in-loop
      await module.createTables(trx);
    }
    for (const module of REFERENCE_DATA_MODULES) {
      // eslint-disable-next-line no-await-in-loop
      await module.run(trx);
    }
    await writeStoredHash(trx, hash);
  });
}

async function ensureSchemaBaselines(db: Kysely<Database>): Promise<void> {
  await db.transaction().execute(async (trx) => {
    for (const module of SCHEMA_MODULES) {
      // eslint-disable-next-line no-await-in-loop
      await module.ensureBaseline?.(trx);
    }
  });
}

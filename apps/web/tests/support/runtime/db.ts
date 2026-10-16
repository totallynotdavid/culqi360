import { rm } from "node:fs/promises";
import { join } from "node:path";

import { sql, type Kysely } from "kysely";
import { Client } from "pg";
import { inject } from "vitest";

import {
  BranchId,
  OrganizationId,
  OrganizationPersonId,
  PersonId,
  UserId,
} from "~/domain/ids";
import { createDb } from "~/server/platform/database/client";
import { migrateToLatest } from "~/server/platform/database/migrate";
import { REFERENCE_DATA_MODULES } from "~/server/platform/database/schema";
import type { Database } from "~/server/platform/database/types";

import {
  createTestRepositories,
  type TestRepositories,
} from "../runtime/repos";
import { TEST_WEB_DB_URL_CONTEXT } from "./test-context";

// Each test file clones a seeded template; resetTestDb restores fixtures between
// cases.
const NAMESPACE = (process.env.TEST_DB_NAMESPACE ?? "default").replace(
  /[^a-z0-9_]/gi,
  "_",
);
const TEMPLATE_DB_NAME = `crm_test_template_${NAMESPACE}`.toLowerCase();

const TEMPLATE_LOCK_KEY = 0x6372_6d74; // "crmt"

const TEST_ORG_ID_LIMA = OrganizationId.trust(
  "01974fd5-f261-7a7d-93f5-2f3d0f963001",
);
const TEST_ORG_ID_NORTE = OrganizationId.trust(
  "01974fd5-f261-7a7d-93f5-2f3d0f963002",
);

const BRANCH_LIMA_ID = BranchId.trust("01974fd5-f261-7a7d-93f5-2f3d0f960001");
const BRANCH_NORTE_ID = BranchId.trust("01974fd5-f261-7a7d-93f5-2f3d0f960002");

const USER_EXEC_ONE_ID = UserId.trust("01974fd5-f261-7a7d-93f5-2f3d0f961001");
const USER_BACK_ONE_ID = UserId.trust("01974fd5-f261-7a7d-93f5-2f3d0f961002");
const USER_EXEC_TWO_ID = UserId.trust("01974fd5-f261-7a7d-93f5-2f3d0f961003");
const USER_BACK_TWO_ID = UserId.trust("01974fd5-f261-7a7d-93f5-2f3d0f961004");
const USER_SUPER_ID = UserId.trust("01974fd5-f261-7a7d-93f5-2f3d0f961005");

const PERSON_LIMA_ID = PersonId.trust("01974fd5-f261-7a7d-93f5-2f3d0f962001");
const PERSON_NORTE_ID = PersonId.trust("01974fd5-f261-7a7d-93f5-2f3d0f962002");

const ORG_PERSON_LIMA_ID = OrganizationPersonId.trust(
  "01974fd5-f261-7a7d-93f5-2f3d0f964001",
);
const ORG_PERSON_NORTE_ID = OrganizationPersonId.trust(
  "01974fd5-f261-7a7d-93f5-2f3d0f964002",
);

export const TEST_FIXTURES = {
  branches: {
    lima: { id: BRANCH_LIMA_ID },
    norte: { id: BRANCH_NORTE_ID },
  },
  users: {
    execOne: { id: USER_EXEC_ONE_ID, branchId: BRANCH_LIMA_ID },
    backOne: { id: USER_BACK_ONE_ID, branchId: BRANCH_LIMA_ID },
    execTwo: { id: USER_EXEC_TWO_ID, branchId: BRANCH_NORTE_ID },
    backTwo: { id: USER_BACK_TWO_ID, branchId: BRANCH_NORTE_ID },
    superUser: { id: USER_SUPER_ID, branchId: BRANCH_NORTE_ID },
  },
  organizations: {
    lima: { id: TEST_ORG_ID_LIMA, ruc: "20100000001" },
    norte: { id: TEST_ORG_ID_NORTE, ruc: "20100000002" },
  },
  people: {
    lima: { id: PERSON_LIMA_ID, dni: "70000001" },
    norte: { id: PERSON_NORTE_ID, dni: "70000002" },
  },
  organizationPeople: {
    lima: { id: ORG_PERSON_LIMA_ID },
    norte: { id: ORG_PERSON_NORTE_ID },
  },
} as const;

export function databaseUrl(
  name: string,
  connectionString = inject(TEST_WEB_DB_URL_CONTEXT),
): string {
  const url = new URL(connectionString);
  url.pathname = `/${name}`;
  return url.toString();
}

function assertSafeDbName(name: string): void {
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`unsafe database name: ${name}`);
  }
}

async function withMaintenanceClient<T>(
  fn: (client: Client) => Promise<T>,
  connectionString = inject(TEST_WEB_DB_URL_CONTEXT),
): Promise<T> {
  const client = new Client({
    connectionString: databaseUrl("postgres", connectionString),
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function seedFixtures(db: Kysely<Database>) {
  const now = new Date();

  await db
    .insertInto("branches")
    .values([
      { id: BRANCH_LIMA_ID, name: "Lima", created_at: now },
      { id: BRANCH_NORTE_ID, name: "Norte", created_at: now },
    ])
    .execute();

  await db
    .insertInto("users")
    .values([
      {
        id: USER_EXEC_ONE_ID,
        branch_id: BRANCH_LIMA_ID,
        team_id: null,
        username: "exec.one",
        email: "exec1@test.local",
        password_hash: "hash",
        names: "Exec",
        first_surname: "One",
        second_surname: "Alpha",
        onboarding_completed_at: now,
        role: "executive",
        is_active: true,
        created_at: now,
      },
      {
        id: USER_BACK_ONE_ID,
        branch_id: BRANCH_LIMA_ID,
        team_id: null,
        username: "back.one",
        email: "back1@test.local",
        password_hash: "hash",
        names: "Back",
        first_surname: "One",
        second_surname: "Alpha",
        onboarding_completed_at: now,
        role: "back_office",
        is_active: true,
        created_at: now,
      },
      {
        id: USER_EXEC_TWO_ID,
        branch_id: BRANCH_NORTE_ID,
        team_id: null,
        username: "exec.two",
        email: "exec2@test.local",
        password_hash: "hash",
        names: "Exec",
        first_surname: "Two",
        second_surname: "Beta",
        onboarding_completed_at: now,
        role: "executive",
        is_active: true,
        created_at: now,
      },
      {
        id: USER_BACK_TWO_ID,
        branch_id: BRANCH_NORTE_ID,
        team_id: null,
        username: "back.two",
        email: "back2@test.local",
        password_hash: "hash",
        names: "Back",
        first_surname: "Two",
        second_surname: "Beta",
        onboarding_completed_at: now,
        role: "back_office",
        is_active: true,
        created_at: now,
      },
      {
        id: USER_SUPER_ID,
        branch_id: BRANCH_NORTE_ID,
        team_id: null,
        username: "super.user",
        email: "super@test.local",
        password_hash: "hash",
        names: "Super",
        first_surname: "User",
        second_surname: "Gamma",
        onboarding_completed_at: now,
        role: "superuser",
        is_active: true,
        created_at: now,
      },
    ])
    .execute();

  await db
    .insertInto("organizations")
    .values([
      {
        id: TEST_ORG_ID_LIMA,
        ruc: "20100000001",
        legal_name: "Org Lima",
        line_of_business: null,
        address: null,
        district: null,
        province: null,
        department: null,
        phone: null,
        email: null,
        created_at: now,
      },
      {
        id: TEST_ORG_ID_NORTE,
        ruc: "20100000002",
        legal_name: "Org Norte",
        line_of_business: null,
        address: null,
        district: null,
        province: null,
        department: null,
        phone: null,
        email: null,
        created_at: now,
      },
    ])
    .execute();

  await db
    .insertInto("people")
    .values([
      {
        id: PERSON_LIMA_ID,
        dni: "70000001",
        names: "Contacto",
        first_surname: "Lima",
        second_surname: null,
        email: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: PERSON_NORTE_ID,
        dni: "70000002",
        names: "Contacto",
        first_surname: "Norte",
        second_surname: null,
        email: null,
        created_at: now,
        updated_at: now,
      },
    ])
    .execute();

  await db
    .insertInto("organization_people")
    .values([
      {
        id: ORG_PERSON_LIMA_ID,
        person_id: PERSON_LIMA_ID,
        organization_id: TEST_ORG_ID_LIMA,
        phone: "999999111",
        email: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: ORG_PERSON_NORTE_ID,
        person_id: PERSON_NORTE_ID,
        organization_id: TEST_ORG_ID_NORTE,
        phone: "999999222",
        email: null,
        created_at: now,
        updated_at: now,
      },
    ])
    .execute();
}

export interface TestDbContext {
  dbName: string;
  storageRoot: string;
  db: Kysely<Database>;
  repos: TestRepositories;
  fixtures: typeof TEST_FIXTURES;
}

let templatePromise: Promise<void> | null = null;

async function templateExists(client: Client): Promise<boolean> {
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [TEMPLATE_DB_NAME],
  );
  return result.rowCount === 1;
}

async function buildTemplate(connectionString: string): Promise<void> {
  assertSafeDbName(TEMPLATE_DB_NAME);

  await withMaintenanceClient(async (client) => {
    await client.query("SELECT pg_advisory_lock($1)", [TEMPLATE_LOCK_KEY]);
    try {
      if (await templateExists(client)) {
        return;
      }
      await client.query(`CREATE DATABASE "${TEMPLATE_DB_NAME}"`);

      try {
        const db = createDb(() =>
          databaseUrl(TEMPLATE_DB_NAME, connectionString),
        );
        try {
          await migrateToLatest(db);
          await seedFixtures(db);
        } finally {
          // Postgres cannot clone a database with live connections.
          await db.destroy();
        }
      } catch (error) {
        // Rebuild a template whose migrations or fixtures failed.
        await client.query(
          `DROP DATABASE IF EXISTS "${TEMPLATE_DB_NAME}" WITH (FORCE)`,
        );
        throw error;
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [TEMPLATE_LOCK_KEY]);
    }
  }, connectionString);
}

async function ensureTemplate(
  connectionString = inject(TEST_WEB_DB_URL_CONTEXT),
): Promise<void> {
  if (!templatePromise) {
    templatePromise = buildTemplate(connectionString).catch((error) => {
      templatePromise = null;
      throw error;
    });
  }
  return templatePromise;
}

export async function prepareTestDbTemplate(
  connectionString: string,
): Promise<void> {
  await ensureTemplate(connectionString);
}

export async function createIsolatedTestDb(
  prefix: string,
): Promise<TestDbContext> {
  await ensureTemplate();

  const runId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const dbName = `crm_test_${prefix}_${runId}`
    .replace(/[^a-z0-9_]/gi, "_")
    .toLowerCase();
  assertSafeDbName(dbName);

  await withMaintenanceClient(async (client) => {
    await client.query(
      `CREATE DATABASE "${dbName}" TEMPLATE "${TEMPLATE_DB_NAME}"`,
    );
  });

  const storageRoot = join(
    process.cwd(),
    ".vitest-files",
    `${prefix}-${runId}`,
  );
  const db = createDb(() => databaseUrl(dbName));
  const repos = createTestRepositories(db);

  return {
    dbName,
    storageRoot,
    db,
    repos,
    fixtures: TEST_FIXTURES,
  };
}

// Truncating schema_integrity would make migrations appear unapplied.
const STATIC_TABLES = new Set(["schema_integrity"]);

async function truncateDynamicTables(db: Kysely<Database>): Promise<void> {
  const { rows } = await sql<{ tablename: string }>`
    select tablename from pg_tables where schemaname = 'public'
  `.execute(db);

  const targets = rows
    .map((row) => row.tablename)
    .filter((name) => !STATIC_TABLES.has(name));

  if (targets.length === 0) {
    return;
  }

  await sql`truncate table ${sql.join(targets.map((name) => sql.table(name)))} cascade`.execute(
    db,
  );
}

// Reset each case, not once per test file.
export async function resetTestDb(ctx: TestDbContext): Promise<void> {
  await truncateDynamicTables(ctx.db);
  for (const module of REFERENCE_DATA_MODULES) {
    // eslint-disable-next-line no-await-in-loop
    await module.run(ctx.db);
  }
  await seedFixtures(ctx.db);
}

export async function cleanupTestDb(
  ctx: TestDbContext | null | undefined,
): Promise<void> {
  if (!ctx) {
    return;
  }

  await ctx.db.destroy();
  assertSafeDbName(ctx.dbName);

  await withMaintenanceClient(async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${ctx.dbName}" WITH (FORCE)`);
  });

  await rm(ctx.storageRoot, { force: true, recursive: true });
}

export interface FreshDbContext {
  dbName: string;
  db: Kysely<Database>;
}

// Use an unmigrated database only for migration and seeding tests.
export async function createFreshDb(prefix: string): Promise<FreshDbContext> {
  const dbName = `crm_test_fresh_${prefix}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`
    .replace(/[^a-z0-9_]/gi, "_")
    .toLowerCase();
  assertSafeDbName(dbName);

  await withMaintenanceClient(async (client) => {
    await client.query(`CREATE DATABASE "${dbName}"`);
  });

  return { dbName, db: createDb(() => databaseUrl(dbName)) };
}

export async function cleanupFreshDb(
  ctx: FreshDbContext | null | undefined,
): Promise<void> {
  if (!ctx) {
    return;
  }

  await ctx.db.destroy();
  assertSafeDbName(ctx.dbName);

  await withMaintenanceClient(async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${ctx.dbName}" WITH (FORCE)`);
  });
}

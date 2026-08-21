import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { sql, type Kysely } from "kysely";
import { Client } from "pg";

import { TeamId, UserId } from "~/domain/ids";
import { hashPassword } from "~/server/auth/password/password";
import {
  hashSessionToken,
  isValidTokenFormat,
} from "~/server/auth/session/tokens";
import { createDb } from "~/server/platform/database/client";
import { migrateToLatest } from "~/server/platform/database/migrate";
import { provisionInstallation } from "~/server/platform/database/seeds/installation";
import { INFINITY_BRANCH_ID } from "~/server/platform/database/seeds/installation/persist/branches-policies";
import { createSeedContext } from "~/server/platform/database/seeds/shared/context";
import type { Database } from "~/server/platform/database/types";

import { withDatabase } from "../../tests/e2e/db";
import {
  type E2EManifest,
  type GuardCount,
  type ResetPlan,
  writeManifest,
} from "../../tests/e2e/manifest";
import { ROSTER } from "../../tests/e2e/roster";
import { sourceFingerprint } from "../support/source-fingerprint";

const TEMPLATE_DB = "crm_e2e_template";
const WORKER_DB_PREFIX = "crm_e2e_w";
const BUILD_HASH_FILE = resolve(process.cwd(), "dist/.e2e-build-hash");
// The build artifact proves the build is fresh; the runnable server is the
// Bun entrypoint that imports it.
const BUILD_ARTIFACT = resolve(process.cwd(), "dist/server/server.js");
const SERVER_ENTRY = resolve(process.cwd(), "server.ts");
const ROSTER_PASSWORD = "E2ePassw0rd!";

// Executives need a team to resolve their workspace.
const E2E_TEAM_ID = TeamId.trust("0e2e0000-0000-7000-8000-0000000000a1");

function baseUrl(): string {
  const url = process.env.WEB_DB_URL;

  if (!url) {
    throw new Error(
      "WEB_DB_URL is not set; run e2e via the test:e2e script so .env.test is loaded",
    );
  }

  return url;
}

async function withMaintenance<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const maintenanceUrl = withDatabase(baseUrl(), "postgres");
  const client = new Client({ connectionString: maintenanceUrl });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Postgres is not reachable at ${maintenanceUrl}. ` +
        "Start it first (e.g. `bun run dev:infra` from the repo root).",
      { cause: error },
    );
  }

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Remove databases left by crashed or interrupted runs.
async function dropStaleDatabases(client: Client): Promise<void> {
  const { rows } = await client.query<{ datname: string }>(
    `SELECT datname FROM pg_database WHERE datname = $1 OR datname LIKE $2`,
    [TEMPLATE_DB, `${WORKER_DB_PREFIX}%`],
  );

  for (const { datname } of rows) {
    // eslint-disable-next-line no-await-in-loop
    await client.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
  }
}

const FINGERPRINT_ROOTS = [
  "src",
  "vite.config.ts",
  "package.json",
  "tracer.ts",
];

function buildIfStale(): void {
  const fingerprint = sourceFingerprint(FINGERPRINT_ROOTS);
  const built =
    existsSync(BUILD_ARTIFACT) &&
    existsSync(BUILD_HASH_FILE) &&
    readFileSync(BUILD_HASH_FILE, "utf8") === fingerprint;

  if (built) {
    console.log("[e2e] build up to date, skipping");
    return;
  }

  console.log("[e2e] building app (dist)...");

  // NODE_ENV=test breaks Rolldown's resolution of shiki's onig.wasm.
  const result = spawnSync("bun", ["run", "build:container"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });

  if (result.status !== 0) {
    throw new Error(`vite build failed with code ${result.status}`);
  }

  writeFileSync(BUILD_HASH_FILE, fingerprint);
}

async function seedRoster(db: Kysely<Database>, now: Date): Promise<void> {
  const passwordHash = await hashPassword(ROSTER_PASSWORD);
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db
    .insertInto("teams")
    .values({
      id: E2E_TEAM_ID,
      branch_id: INFINITY_BRANCH_ID,
      name: "E2E Team",
      created_at: now,
    })
    .execute();

  for (const user of ROSTER) {
    if (!isValidTokenFormat(user.token)) {
      throw new Error(`roster token for '${user.key}' is not a valid format`);
    }

    // eslint-disable-next-line no-await-in-loop
    await db
      .insertInto("users")
      .values({
        id: UserId.trust(user.userId),
        branch_id: INFINITY_BRANCH_ID,
        team_id: user.role === "executive" ? E2E_TEAM_ID : null,
        username: user.username,
        email: user.email,
        password_hash: passwordHash,
        names: "E2E",
        first_surname: user.role,
        second_surname: "User",
        onboarding_completed_at: now,
        role: user.role,
        is_active: true,
        created_at: now,
      })
      .execute();

    // eslint-disable-next-line no-await-in-loop
    await db
      .insertInto("user_sessions")
      .values({
        id: hashSessionToken(user.token),
        user_id: UserId.trust(user.userId),
        branch_id: INFINITY_BRANCH_ID,
        role: user.role,
        session_class: "app",
        primary_auth_method: "password",
        strong_auth_method: null,
        strong_auth_at: null,
        impersonator_user_id: null,
        ip_address: "127.0.0.1",
        user_agent: "e2e",
        created_at: now,
        last_activity: now,
        expires_at: expiresAt,
      })
      .execute();
  }
}

async function tableNames(db: Kysely<Database>): Promise<string[]> {
  const { rows } = await sql<{ tablename: string }>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `.execute(db);

  return rows.map((row) => row.tablename);
}

async function nonEmptyTables(
  db: Kysely<Database>,
  tables: string[],
): Promise<Set<string>> {
  const nonEmpty = new Set<string>();

  for (const table of tables) {
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await sql<{ present: number }>`
      SELECT 1 AS present
      FROM ${sql.table(table)}
      LIMIT 1
    `.execute(db);

    if (rows.length > 0) {
      nonEmpty.add(table);
    }
  }

  return nonEmpty;
}

// Normalize regclass output to match pg_tables.tablename.
function cleanRegclass(name: string): string {
  return name.replace(/^public\./, "").replace(/"/g, "");
}

async function foreignKeyEdges(
  db: Kysely<Database>,
): Promise<Array<{ child: string; parent: string }>> {
  const { rows } = await sql<{ child: string; parent: string }>`
    SELECT
      con.conrelid::regclass::text AS child,
      con.confrelid::regclass::text AS parent
    FROM pg_constraint con
    WHERE
      con.contype = 'f'
      AND con.connamespace = 'public'::regnamespace
  `.execute(db);

  return rows.map((row) => ({
    child: cleanRegclass(row.child),
    parent: cleanRegclass(row.parent),
  }));
}

const MANAGED_IDENTITY_TABLES = ["user_sessions", "users", "teams"] as const;

type ManagedIdentityTable = (typeof MANAGED_IDENTITY_TABLES)[number];

function deleteNonBaseline(table: string, ids: string[]): string {
  if (!ids.length) {
    return `DELETE FROM "${table}"`;
  }

  const literals = ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(", ");

  return `DELETE FROM "${table}" WHERE id::text NOT IN (${literals})`;
}

// Preserve seeded tables and every table they reference. Truncating a referenced
// table with CASCADE could otherwise delete rows from a preserved table.
async function computeResetPlan(db: Kysely<Database>): Promise<ResetPlan> {
  const tables = await tableNames(db);
  const preserve = await nonEmptyTables(db, tables);
  const edges = await foreignKeyEdges(db);

  let changed = true;

  while (changed) {
    changed = false;

    for (const { child, parent } of edges) {
      if (preserve.has(child) && !preserve.has(parent)) {
        preserve.add(parent);
        changed = true;
      }
    }
  }

  const truncateTargets = tables.filter((table) => !preserve.has(table));
  const truncateSql = truncateTargets.length
    ? `TRUNCATE TABLE ${truncateTargets
        .map((table) => `"${table}"`)
        .join(", ")} RESTART IDENTITY CASCADE`
    : null;

  const baseline = async (table: ManagedIdentityTable): Promise<string[]> => {
    const { rows } = await sql<{ id: string }>`
      SELECT id::text AS id
      FROM ${sql.table(table)}
    `.execute(db);

    return rows.map((row) => row.id);
  };

  const deleteSql: string[] = [];

  // Sessions must be deleted before users, and users before teams.
  for (const table of MANAGED_IDENTITY_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    const ids = await baseline(table);

    deleteSql.push(deleteNonBaseline(table, ids));
  }

  const managed = new Set<string>(MANAGED_IDENTITY_TABLES);
  const guardCounts: GuardCount[] = [];

  for (const table of preserve) {
    if (managed.has(table)) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const { rows } = await sql<{ n: number }>`
      SELECT count(*)::int AS n
      FROM ${sql.table(table)}
    `.execute(db);

    guardCounts.push({
      table,
      count: rows[0]?.n ?? 0,
    });
  }

  return {
    truncateSql,
    deleteSql,
    guardCounts,
  };
}

async function buildTemplate(): Promise<ResetPlan> {
  await withMaintenance(async (client) => {
    await dropStaleDatabases(client);
    await client.query(`CREATE DATABASE "${TEMPLATE_DB}"`);
  });

  const db = createDb(() => withDatabase(baseUrl(), TEMPLATE_DB));

  try {
    await migrateToLatest(db);

    const context = createSeedContext();

    await provisionInstallation(db, context.anchorDate);
    await seedRoster(db, context.anchorDate);

    return await computeResetPlan(db);
  } finally {
    // PostgreSQL cannot clone a database while it has open connections.
    await db.destroy();
  }
}

async function main(): Promise<void> {
  buildIfStale();

  const reset = await buildTemplate();
  const manifest: E2EManifest = {
    maintenanceUrl: withDatabase(baseUrl(), "postgres"),
    templateDb: TEMPLATE_DB,
    serverEntry: SERVER_ENTRY,
    reset,
  };

  writeManifest(manifest);

  console.log(`[e2e] template ready: ${TEMPLATE_DB}`);
}

await main();

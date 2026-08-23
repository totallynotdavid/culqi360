import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { Client } from "pg";

import { createDb } from "~/server/platform/database/client";
import { migrateToLatest } from "~/server/platform/database/migrate";
import { seedIfEmpty } from "~/server/platform/database/seed";

import { withDatabase } from "../../tests/e2e/db";
import { sourceFingerprint } from "../support/source-fingerprint";
import { mintAllSessions } from "./roster";

// Hardcoded so this tool cannot resolve to the development database.
const PREVIEW_DB_NAME = "crm_preview";

const FINGERPRINT_FILE = resolve(process.cwd(), ".preview-db-fingerprint");

// Only schema and seed changes require rebuilding the preview database.
const FINGERPRINT_ROOTS = [
  "src/server/platform/database/schema",
  "src/server/platform/database/seeds",
];

const DEFAULT_MAINTENANCE_URL = "postgres://postgres@localhost:5432/postgres";

function baseUrl(): string {
  return process.env.WEB_DB_URL?.trim() || DEFAULT_MAINTENANCE_URL;
}

function maintenanceUrl(): string {
  return withDatabase(baseUrl(), "postgres");
}

export function previewDbUrl(): string {
  return withDatabase(baseUrl(), PREVIEW_DB_NAME);
}

async function withMaintenance<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: maintenanceUrl() });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      "Postgres is not reachable. Start it first (e.g. `bun run dev:infra` from the repo root).",
      { cause: error },
    );
  }

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function isUpToDate(): boolean {
  if (!existsSync(FINGERPRINT_FILE)) {
    return false;
  }

  return (
    readFileSync(FINGERPRINT_FILE, "utf8") ===
    sourceFingerprint(FINGERPRINT_ROOTS)
  );
}

async function databaseExists(): Promise<boolean> {
  return withMaintenance(async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [PREVIEW_DB_NAME],
    );

    return rows.length > 0;
  });
}

async function rebuild(): Promise<void> {
  console.log("[preview] rebuilding crm_preview...");

  await withMaintenance(async (client) => {
    await client.query(
      `DROP DATABASE IF EXISTS "${PREVIEW_DB_NAME}" WITH (FORCE)`,
    );
    await client.query(`CREATE DATABASE "${PREVIEW_DB_NAME}"`);
  });

  const db = createDb(previewDbUrl);

  try {
    await migrateToLatest(db);
    await seedIfEmpty(db);

    const minted = await mintAllSessions(db, new Date());

    console.log(
      `[preview] seeded crm_preview, minted sessions for ${minted} users`,
    );
  } finally {
    await db.destroy();
  }

  writeFileSync(FINGERPRINT_FILE, sourceFingerprint(FINGERPRINT_ROOTS));
}

// Returns true when callers need to restart against the rebuilt database.
export async function ensureDatabase(options: {
  fresh: boolean;
}): Promise<boolean> {
  const exists = await databaseExists();

  if (!options.fresh && exists && isUpToDate()) {
    return false;
  }

  await rebuild();

  return true;
}

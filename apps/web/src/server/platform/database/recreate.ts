import { Client } from "pg";

// Names are interpolated into DDL, which cannot take bind parameters.
const SAFE_DB_NAME = /^[a-z0-9_]+$/;

const MAINTENANCE_DB_NAME = "postgres";

function databaseName(url: URL): string {
  const name = url.pathname.replace(/^\//, "");

  if (!SAFE_DB_NAME.test(name)) {
    throw new Error(`refusing to recreate database with unsafe name: ${name}`);
  }
  if (name === MAINTENANCE_DB_NAME) {
    throw new Error("refusing to recreate the maintenance database");
  }

  return name;
}

/**
 * Drops the database named by `databaseUrl` (disconnecting its sessions) and
 * creates it empty. The schema is rebuilt by the next `migrateToLatest`.
 */
export async function recreateDatabase(databaseUrl: string): Promise<void> {
  const target = new URL(databaseUrl);
  const name = databaseName(target);

  const maintenance = new URL(databaseUrl);
  maintenance.pathname = `/${MAINTENANCE_DB_NAME}`;

  const client = new Client({ connectionString: maintenance.toString() });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      "Postgres is not reachable. Start it first (e.g. `bun run dev:infra` from the repo root).",
      { cause: error },
    );
  }

  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}

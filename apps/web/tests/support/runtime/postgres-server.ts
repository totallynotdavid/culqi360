import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { Client } from "pg";

const execFileAsync = promisify(execFile);

const DEFAULT_BASE_URL = "postgres://postgres@127.0.0.1:5432/postgres";
const EXPLICIT_TEST_DB_URL = process.env.TEST_WEB_DB_URL;

const SERVER_ROOT =
  process.env.TEST_DB_SERVER_ROOT ??
  join(process.cwd(), ".vitest-db", "postgres-server");
const DATA_DIR = join(SERVER_ROOT, "data");
const LOG_FILE = join(SERVER_ROOT, "postgres.log");
const PORT_FILE = join(SERVER_ROOT, "port");
const LOCK_DIR = join(dirname(SERVER_ROOT), "postgres-server.lock");
const LEASE_DIR = join(SERVER_ROOT, "leases");

const CONNECTION_TIMEOUT_MS = 15_000;
const LOCK_WAIT_MS = 30_000;
const POLL_INTERVAL_MS = 100;
const IS_CI =
  process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function databaseUrl(baseUrl: string, name: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function connectionSettings(connectionString: string) {
  const url = new URL(connectionString);
  return {
    host: url.hostname || "localhost",
    port: url.port || "5432",
    user: decodeURIComponent(url.username || "postgres"),
  };
}

async function runPostgresTool(command: string, args: string[]): Promise<void> {
  try {
    await execFileAsync("mise", ["x", "postgres", "--", command, ...args], {
      cwd: process.cwd(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to run ${command}: ${message}`, { cause: error });
  }
}

async function runPgCtl(args: string[]): Promise<void> {
  await runPostgresTool("pg_ctl", ["-D", DATA_DIR, ...args]);
}

async function canConnect(connectionString: string): Promise<boolean> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 500,
  });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function managedServerPid(): Promise<number | null> {
  try {
    const pid = Number(
      (await readFile(join(DATA_DIR, "postmaster.pid"), "utf8"))
        .split("\n")[0]
        ?.trim(),
    );
    if (!Number.isInteger(pid) || pid <= 0) {
      return null;
    }

    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

async function isManagedServerRunning(): Promise<boolean> {
  return (await managedServerPid()) !== null;
}

async function waitForServer(connectionString: string): Promise<void> {
  const deadline = Date.now() + CONNECTION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await canConnect(connectionString)) {
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  let log = "";
  try {
    log = await readFile(LOG_FILE, "utf8");
  } catch {
    log = "postgres log was not created";
  }

  throw new Error(
    `Postgres did not become ready within ${CONNECTION_TIMEOUT_MS}ms.\n${log}`,
  );
}

async function withStartupLock<T>(fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (true) {
    try {
      await mkdir(LOCK_DIR);
      break;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST" &&
        Date.now() < deadline
      ) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      throw error;
    }
  }

  try {
    return await fn();
  } finally {
    await rm(LOCK_DIR, { force: true, recursive: true });
  }
}

async function initializeDataDir(): Promise<void> {
  await runPostgresTool("initdb", [
    "-D",
    DATA_DIR,
    "-U",
    connectionSettings(DEFAULT_BASE_URL).user,
    "--auth=trust",
  ]);
}

async function startManagedServer(connectionString: string): Promise<void> {
  const { host, port } = connectionSettings(connectionString);
  await runPgCtl([
    "-l",
    LOG_FILE,
    "-o",
    `-h ${host} -p ${port} -k /tmp`,
    "start",
  ]);
}

async function stopManagedServer(): Promise<void> {
  if (!(await isManagedServerRunning())) {
    return;
  }

  await runPgCtl(["stop", "-m", "fast"]);
}

function leaseName(): string {
  const namespace = process.env.TEST_DB_NAMESPACE ?? "default";
  return `${namespace}-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function leasePath(name: string): string {
  return join(LEASE_DIR, name);
}

function managedConnectionString(port: number): string {
  const url = new URL(DEFAULT_BASE_URL);
  url.port = String(port);
  return databaseUrl(url.toString(), "postgres");
}

async function findFreePort(): Promise<number> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => resolve());
  });

  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  if (!address || typeof address === "string") {
    throw new Error("failed to determine the free Postgres port");
  }

  return address.port;
}

async function readManagedPort(): Promise<number | null> {
  try {
    const port = Number((await readFile(PORT_FILE, "utf8")).trim());
    return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

async function acquireLease(): Promise<string> {
  await mkdir(LEASE_DIR, { recursive: true });
  const name = leaseName();
  await writeFile(leasePath(name), `${process.pid}\n`, { flag: "wx" });
  return name;
}

async function removeStaleLeases(): Promise<void> {
  let names: string[];
  try {
    names = await readdir(LEASE_DIR);
  } catch {
    return;
  }

  await Promise.all(
    names.map(async (name) => {
      try {
        const pid = Number((await readFile(leasePath(name), "utf8")).trim());
        if (!Number.isInteger(pid) || pid <= 0) {
          await rm(leasePath(name), { force: true });
          return;
        }
        process.kill(pid, 0);
      } catch {
        await rm(leasePath(name), { force: true });
      }
    }),
  );
}

async function hasActiveLeases(): Promise<boolean> {
  await removeStaleLeases();
  try {
    return (await readdir(LEASE_DIR)).length > 0;
  } catch {
    return false;
  }
}

async function rollbackManagedServerStart(options: {
  lease: string;
  dataDirCreated: boolean;
  portFileChanged: boolean;
  previousPortFile: string | undefined;
}): Promise<void> {
  await rm(leasePath(options.lease), { force: true });
  if (options.dataDirCreated) {
    await rm(DATA_DIR, { force: true, recursive: true });
  }
  if (!options.portFileChanged) {
    return;
  }
  if (options.previousPortFile === undefined) {
    await rm(PORT_FILE, { force: true });
    return;
  }
  await writeFile(PORT_FILE, options.previousPortFile);
}

export interface PostgresServerLease {
  connectionString: string;
  release: () => Promise<void>;
}

async function startOrAttachManagedServer(): Promise<{
  connectionString: string;
  lease: string | null;
}> {
  if (EXPLICIT_TEST_DB_URL) {
    return {
      connectionString: databaseUrl(EXPLICIT_TEST_DB_URL, "postgres"),
      lease: null,
    };
  }

  if (IS_CI) {
    const connectionString = databaseUrl(
      process.env.WEB_DB_URL ?? DEFAULT_BASE_URL,
      "postgres",
    );
    if (!(await canConnect(connectionString))) {
      throw new Error(
        `Postgres is not reachable at ${connectionString}. CI must provide the Postgres service instead of relying on local test startup.`,
      );
    }
    return { connectionString, lease: null };
  }

  await mkdir(SERVER_ROOT, { recursive: true });

  return withStartupLock(async () => {
    const storedPort = await readManagedPort();
    if (storedPort !== null) {
      const connectionString = managedConnectionString(storedPort);
      if (await isManagedServerRunning()) {
        try {
          await waitForServer(connectionString);
          return {
            connectionString,
            lease: await acquireLease(),
          };
        } catch (error) {
          if (await hasActiveLeases()) {
            throw error;
          }
          await stopManagedServer();
        }
      } else if (await hasActiveLeases()) {
        throw new Error(
          `managed Postgres at ${connectionString} has active leases but is not running`,
        );
      }
    }

    if (storedPort === null && (await isManagedServerRunning())) {
      if (await hasActiveLeases()) {
        throw new Error(
          "managed Postgres has active leases but no recorded port",
        );
      }
      await stopManagedServer();
    }

    const connectionString = managedConnectionString(await findFreePort());
    const lease = await acquireLease();
    let serverStarted = false;
    let previousPortFile: string | undefined;
    let portFileChanged = false;
    let dataDirCreated = false;

    try {
      try {
        previousPortFile = await readFile(PORT_FILE, "utf8");
      } catch (error) {
        if (!isNotFound(error)) {
          throw error;
        }
      }
      await writeFile(PORT_FILE, connectionSettings(connectionString).port);
      portFileChanged = true;
      try {
        await readFile(join(DATA_DIR, "PG_VERSION"), "utf8");
      } catch (error) {
        if (!isNotFound(error)) {
          throw error;
        }
        dataDirCreated = true;
        await initializeDataDir();
      }
    } catch (error) {
      await rollbackManagedServerStart({
        lease,
        dataDirCreated,
        portFileChanged,
        previousPortFile,
      });
      throw error;
    }

    try {
      await startManagedServer(connectionString);
      serverStarted = true;
      await waitForServer(connectionString);
      return { connectionString, lease };
    } catch (error) {
      if (serverStarted) {
        await stopManagedServer();
      }
      await rollbackManagedServerStart({
        lease,
        dataDirCreated,
        portFileChanged,
        previousPortFile,
      });
      throw error;
    }
  });
}

export async function acquirePostgresServer(): Promise<PostgresServerLease> {
  const { connectionString, lease } = await startOrAttachManagedServer();

  return {
    connectionString,
    release: async () => {
      if (!lease) {
        return;
      }

      await withStartupLock(async () => {
        await rm(leasePath(lease), { force: true });
        if (await hasActiveLeases()) {
          return;
        }

        await stopManagedServer();
        await rm(SERVER_ROOT, { force: true, recursive: true });
      });
    },
  };
}

import { type ChildProcess, spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const PORT = 3900;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const LOCKFILE = resolve(process.cwd(), ".preview-server.json");
const LOG_FILE = resolve(process.cwd(), ".preview-server.log");

// A fresh Vite cache can spend several minutes pre-bundling dependencies.
const HEALTH_TIMEOUT_MS = 420_000;
const HEALTH_POLL_MS = 200;
const HEALTH_LOG_INTERVAL_MS = 10_000;
const STOP_TIMEOUT_MS = 5_000;

interface Lock {
  pid: number;
  dbUrl: string;
  startedAt: string;
}

function readLock(): Lock | null {
  if (!existsSync(LOCKFILE)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(LOCKFILE, "utf8"));
  } catch {
    return null;
  }
}

function writeLock(lock: Lock): void {
  writeFileSync(LOCKFILE, JSON.stringify(lock, null, 2));
}

function clearLock(): void {
  try {
    unlinkSync(LOCKFILE);
  } catch {
    return;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isHealthy(): Promise<boolean> {
  try {
    // Start mode renders a page only for an HTML-accepting GET; anything else
    // falls through to Vite's own pipeline and 404s, which would read as an
    // unhealthy server forever.
    const response = await fetch(`${BASE_URL}/login`, {
      headers: { accept: "text/html" },
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(proc: ChildProcess): Promise<void> {
  const start = Date.now();
  const deadline = start + HEALTH_TIMEOUT_MS;
  let exited = false;
  let nextLogAt = start + HEALTH_LOG_INTERVAL_MS;

  proc.once("exit", () => {
    exited = true;
  });

  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(
        `preview server exited before becoming healthy; see ${LOG_FILE}`,
      );
    }

    if (await isHealthy()) {
      return;
    }

    const now = Date.now();

    if (now >= nextLogAt) {
      console.log(
        `[preview] still waiting for dev server (${Math.round((now - start) / 1000)}s elapsed, first boot pre-bundles dependencies)...`,
      );
      nextLogAt = now + HEALTH_LOG_INTERVAL_MS;
    }

    await new Promise((done) => setTimeout(done, HEALTH_POLL_MS));
  }

  throw new Error(
    `preview server did not become healthy within ${HEALTH_TIMEOUT_MS}ms; see ${LOG_FILE}`,
  );
}

// Detach the process group so the server survives this CLI process.
// File-backed stdio avoids keeping the parent event loop alive.
async function spawnDetached(dbUrl: string): Promise<number> {
  const log = openSync(LOG_FILE, "a");

  const proc = spawn("bun", ["run", "dev:preview-server"], {
    detached: true,
    stdio: ["ignore", log, log],
    env: {
      ...process.env,
      NODE_ENV: "development",
      WEB_DB_URL: dbUrl,
      PORT: String(PORT),
      HOST: "127.0.0.1",

      // Application-generated links must point at the preview server.
      APP_PUBLIC_ORIGIN: BASE_URL,

      // Exercise notification flows without sending external messages.
      NOTIFICATION_ROUTES: "email:log",

      // Keep preview state isolated from the interactive dev server.
      VITE_CACHE_DIR: resolve(process.cwd(), ".vite-preview"),
      WEB_UPLOADS_ROOT: ".preview-storage/documents",
    },
  });

  closeSync(log);
  proc.unref();

  if (proc.pid === undefined) {
    throw new Error("failed to spawn preview dev server");
  }

  try {
    await waitForHealth(proc);
  } catch (error) {
    killGroup(proc.pid);
    throw error;
  }

  return proc.pid;
}

// Signal the process group so Vite and its child processes stop together.
function killGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    return;
  }
}

function killGroupNow(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    return;
  }
}

export async function stopServer(): Promise<void> {
  const lock = readLock();

  if (!lock) {
    console.log("[preview] no server running");
    return;
  }

  killGroup(lock.pid);

  const deadline = Date.now() + STOP_TIMEOUT_MS;

  while (isAlive(lock.pid) && Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((done) => setTimeout(done, 200));
  }

  if (isAlive(lock.pid)) {
    killGroupNow(lock.pid);
  }

  clearLock();
  console.log(`[preview] stopped (pid ${lock.pid})`);
}

export async function ensureServer(
  dbUrl: string,
  options: { forceRestart: boolean },
): Promise<{ baseURL: string }> {
  const lock = readLock();

  const canReuse =
    !options.forceRestart &&
    lock !== null &&
    lock.dbUrl === dbUrl &&
    isAlive(lock.pid);

  if (canReuse && (await isHealthy())) {
    return { baseURL: BASE_URL };
  }

  if (lock) {
    await stopServer();
  }

  console.log("[preview] starting dev server...");

  const pid = await spawnDetached(dbUrl);

  writeLock({
    pid,
    dbUrl,
    startedAt: new Date().toISOString(),
  });

  return { baseURL: BASE_URL };
}

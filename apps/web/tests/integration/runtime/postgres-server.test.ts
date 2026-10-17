import { execFile, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const CHILD_SCRIPT = fileURLToPath(
  new URL("./postgres-server-child.ts", import.meta.url),
);

interface ManagedChild {
  process: ChildProcess;
  connectionString: string;
  send(command: "query" | "release" | "exit"): Promise<void>;
}

async function canRunManagedPostgres(): Promise<boolean> {
  try {
    await Promise.all(
      ["initdb", "pg_ctl"].map((command) =>
        execFileAsync("mise", ["x", "postgres", "--", command, "--version"]),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

function waitForOutput(child: ChildProcess, expected: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const cleanup = () => {
      child.stdout?.off("data", onStdout);
      child.stderr?.off("data", onStderr);
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null, signal: string | null) => {
      cleanup();
      reject(
        new Error(
          `database child exited before ${expected}: code=${code}, signal=${signal}, stdout=${stdout}, stderr=${stderr}`,
        ),
      );
    };
    const onStderr = (chunk: Buffer | string) => {
      stderr += chunk.toString();
    };
    const onStdout = (chunk: Buffer | string) => {
      stdout += chunk.toString();
      const line = stdout
        .split("\n")
        .find((candidate) => candidate.startsWith(expected));
      if (line) {
        cleanup();
        resolve(line);
      }
    };
    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

async function startChild(
  cwd: string,
  serverRoot?: string,
): Promise<ManagedChild> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CI: "",
    GITHUB_ACTIONS: "",
    TEST_WEB_DB_URL: "",
    WEB_DB_URL: "",
  };
  if (serverRoot === undefined) {
    delete env.TEST_DB_SERVER_ROOT;
  } else {
    env.TEST_DB_SERVER_ROOT = serverRoot;
  }

  const child = spawn(process.execPath, [CHILD_SCRIPT], {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let line: string;
  try {
    line = await waitForOutput(child, "ready:");
  } catch (error) {
    child.kill("SIGTERM");
    await waitForExit(child).catch(() => {});
    throw error;
  }
  return {
    process: child,
    connectionString: line.slice("ready:".length),
    send(command) {
      return new Promise((resolve, reject) => {
        child.stdin?.write(`${command}\n`, (error) =>
          error ? reject(error) : resolve(),
        );
      });
    },
  };
}

async function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => resolve());
  });
}

async function sendAndWait(
  child: ManagedChild,
  command: "query" | "release",
  expected: string,
): Promise<void> {
  const output = waitForOutput(child.process, expected);
  await child.send(command);
  await output;
}

async function releaseChild(child: ManagedChild): Promise<void> {
  await sendAndWait(child, "release", "released:");
  await child.send("exit");
  await waitForExit(child.process);
}

async function runIndependentCheckouts(root: string): Promise<void> {
  const firstCwd = join(root, "checkout-a");
  const secondCwd = join(root, "checkout-b");
  await Promise.all([mkdir(firstCwd), mkdir(secondCwd)]);

  const first = await startChild(firstCwd);
  let second: ManagedChild | undefined;
  try {
    second = await startChild(secondCwd);
    expect(new URL(second.connectionString).port).not.toBe(
      new URL(first.connectionString).port,
    );
    expect(second.connectionString).not.toBe(first.connectionString);

    await releaseChild(first);
    await sendAndWait(second, "query", "query-ok:");
  } finally {
    if (first.process.exitCode === null) {
      await releaseChild(first).catch(() => {});
    }
    if (second) {
      await releaseChild(second).catch(() => {});
    }
  }
}

async function runAttachedCheckouts(root: string): Promise<void> {
  const firstCwd = join(root, "attached-a");
  const secondCwd = join(root, "attached-b");
  const serverRoot = join(root, "shared-server");
  await Promise.all([mkdir(firstCwd), mkdir(secondCwd)]);

  const first = await startChild(firstCwd, serverRoot);
  let second: ManagedChild | undefined;
  try {
    second = await startChild(secondCwd, serverRoot);
    expect(second.connectionString).toBe(first.connectionString);

    await releaseChild(first);
    await sendAndWait(second, "query", "query-ok:");
  } finally {
    if (first.process.exitCode === null) {
      await releaseChild(first).catch(() => {});
    }
    if (second) {
      await releaseChild(second).catch(() => {});
    }
  }
}

const managedPostgresAvailable = await canRunManagedPostgres();

describe.skipIf(!managedPostgresAvailable)(
  "managed Postgres isolation (requires mise x postgres)",
  () => {
    it("keeps independent and attached runs connected after the first run ends", async () => {
      expect.hasAssertions();
      const root = await mkdtemp(join(tmpdir(), "culqi360-postgres-test-"));
      try {
        await runIndependentCheckouts(root);
        await runAttachedCheckouts(root);
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    }, 60_000);
  },
);

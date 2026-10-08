import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HEALTH_TIMEOUT_MS = 60_000;
const HEALTH_POLL_MS = 200;

export interface RunningServer {
  baseURL: string;
  /** Directory this server alone stores uploaded documents in. */
  uploadsRoot: string;
  /** Everything the server has written to stdout and stderr so far. */
  output(): string;
  stop(): Promise<void>;
}

async function waitForHealth(
  baseURL: string,
  proc: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let exited = false;

  proc.once("exit", () => {
    exited = true;
  });

  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(
        "e2e server exited before becoming healthy (see output above)",
      );
    }

    try {
      const response = await fetch(`${baseURL}/login`);

      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
  }

  throw new Error(
    `e2e server did not become healthy within ${HEALTH_TIMEOUT_MS}ms`,
  );
}

export async function startServer(options: {
  serverEntry: string;
  port: number;
  dbUrl: string;
}): Promise<RunningServer> {
  const baseURL = `http://127.0.0.1:${options.port}`;

  // Workers run in parallel against the same checkout. A shared uploads root
  // would let one worker's documents appear in, or be deleted from, another's.
  const uploadsRoot = await mkdtemp(
    join(tmpdir(), `crm-e2e-uploads-${options.port}-`),
  );

  const proc = spawn("bun", ["run", options.serverEntry], {
    env: {
      ...process.env,
      NODE_ENV: "test",

      PORT: String(options.port),
      HOST: "127.0.0.1",

      WEB_DB_URL: options.dbUrl,
      WEB_UPLOADS_ROOT: uploadsRoot,

      // Links are built from this value instead of the incoming request.
      APP_PUBLIC_ORIGIN: baseURL,

      // Run notification flows without sending real email.
      NOTIFICATION_ROUTES: "email:log",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  for (const stream of [proc.stdout, proc.stderr]) {
    stream?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
  }

  const removeUploadsRoot = () =>
    rm(uploadsRoot, { recursive: true, force: true });

  try {
    await waitForHealth(baseURL, proc);
  } catch (error) {
    proc.kill("SIGKILL");
    await removeUploadsRoot();
    throw error;
  }

  return {
    baseURL,
    uploadsRoot,
    output: () => output,

    async stop() {
      // A process ended by a signal keeps `exitCode` null, so both are checked.
      if (proc.exitCode === null && proc.signalCode === null) {
        await new Promise<void>((resolve) => {
          proc.once("exit", resolve);
          proc.kill("SIGTERM");

          // Prevent teardown from hanging if graceful shutdown fails.
          setTimeout(() => proc.kill("SIGKILL"), 3_000);
        });
      }

      await removeUploadsRoot();
    },
  };
}

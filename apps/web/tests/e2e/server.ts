import { type ChildProcess, spawn } from "node:child_process";

const HEALTH_TIMEOUT_MS = 60_000;
const HEALTH_POLL_MS = 200;

export interface RunningServer {
  baseURL: string;
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

  const proc = spawn("bun", ["run", options.serverEntry], {
    env: {
      ...process.env,
      NODE_ENV: "test",

      PORT: String(options.port),
      HOST: "127.0.0.1",

      WEB_DB_URL: options.dbUrl,

      // Links are built from this value instead of the incoming request.
      APP_PUBLIC_ORIGIN: baseURL,

      // Run notification flows without sending real email.
      NOTIFICATION_ROUTES: "email:log",
    },
    stdio: ["ignore", "inherit", "inherit"],
  });

  try {
    await waitForHealth(baseURL, proc);
  } catch (error) {
    proc.kill("SIGKILL");
    throw error;
  }

  return {
    baseURL,

    async stop() {
      if (proc.exitCode !== null) {
        return;
      }

      await new Promise<void>((resolve) => {
        proc.once("exit", resolve);
        proc.kill("SIGTERM");

        // Prevent teardown from hanging if graceful shutdown fails.
        setTimeout(() => proc.kill("SIGKILL"), 3_000);
      });
    },
  };
}

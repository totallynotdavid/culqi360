import { getApplication } from "~/server/composition/application";
import { createLogger } from "~/shared/observability/runtime-logger";

// Nitro owned this through its `close` hook and a plugin bundled into the
// server output. Start mode has no framework process to hook, so the server
// graph owns it: this module is imported by middleware.ts, which the handler
// loads before dispatching anything.
const logger = createLogger("server-runtime");

const application = getApplication();

application.realtime.start();

let stopping = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (stopping) {
    return;
  }

  stopping = true;
  logger.info("realtime_stopping", { signal });

  await application.realtime.stop().catch((error: unknown) => {
    logger.error("realtime_stop_failed", { error });
  });

  process.exit(0);
}

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));

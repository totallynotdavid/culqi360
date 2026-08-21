// Process-level lifecycle for the server: starting realtime, draining it on a
// signal, and the last-resort rejection handler. Start mode has no framework
// process hook, so this runs as import side effects of middleware.ts, which the
// handler loads before dispatching anything.
import { captureException } from "@sentry/bun";

import { getApplication } from "~/server/composition/application";
import { faultMeta } from "~/shared/observability/fault-meta";
import { createLogger } from "~/shared/observability/runtime-logger";

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

  // Stops the engine poll loops before the streams they feed go away.
  application.ingestJobs.stop();

  await application.realtime.stop().catch((error: unknown) => {
    logger.error("realtime_stop_failed", { error });
  });

  process.exit(0);
}

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));

// Bun exits the process on an unhandled rejection; one request's floating
// promise must not take down every other in-flight request. Logged rather than
// swallowed, because an entry here is a bug worth fixing at its source.
process.on("unhandledRejection", (reason: unknown) => {
  logger.error("unhandled_rejection", faultMeta(reason));
  captureException(reason);
});

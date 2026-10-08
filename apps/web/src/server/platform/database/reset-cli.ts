import { createLogger } from "~/shared/observability/runtime-logger";

import { databaseConfig } from "../config/env";
import { recreateDatabase } from "./recreate";

const logger = createLogger("db-reset-cli");

// Production data is never disposable, and the only way to reach it from here
// is an environment that says so.
if (process.env.NODE_ENV === "production") {
  logger.error("reset_refused", { reason: "NODE_ENV is production" });
  process.exit(1);
}

recreateDatabase(databaseConfig().url)
  .then(() => {
    logger.info("reset_complete");
    process.exit(0);
  })
  .catch((err) => {
    logger.error("reset_failed", { error: err });
    process.exit(1);
  });

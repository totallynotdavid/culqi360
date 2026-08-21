import { captureException } from "@sentry/bun";
import { getRequestEvent } from "@solidjs/web";

import type { WireError } from "~/contracts/errors";
import type { DomainError } from "~/domain/errors";
import { createActionObservationsRepo } from "~/server/observability/repos-action-observations";
import { recordActionObservation } from "~/server/observability/service";
import { db } from "~/server/platform/database/db";
import { faultMeta } from "~/shared/observability/fault-meta";
import { createLogger } from "~/shared/observability/runtime-logger";
import type { Result } from "~/shared/result";

import { type ActionDef, createServerFunctionExecutor } from "./run";

const logger = createLogger("action-fault");

const actionObservations = createActionObservationsRepo(db);

const serverFunctionExecutor = createServerFunctionExecutor({
  // Telemetry must never fail the action it is describing, so the write is
  // fired and its rejection swallowed.
  record: (row) => {
    void recordActionObservation(actionObservations, row).catch(() => {});
  },

  report: (error) => {
    logger.error("action_fault", faultMeta(error));
    captureException(error);
  },

  // Keep HTTP response handling at the transport boundary.
  setRetryAfterHeader: (retryAfterSeconds) => {
    getRequestEvent()?.response.headers.set(
      "Retry-After",
      String(retryAfterSeconds),
    );
  },
});

export function executeSessionServerFunctionResult<
  TInput,
  TOutput,
  TError extends DomainError,
>(
  definition: ActionDef<TInput, TOutput, TError>,
): Promise<Result<TOutput, WireError>> {
  return serverFunctionExecutor.executeResult(definition);
}

export function executeSessionServerFunction<
  TInput,
  TOutput,
  TError extends DomainError,
>(definition: ActionDef<TInput, TOutput, TError>) {
  return serverFunctionExecutor.execute(definition);
}

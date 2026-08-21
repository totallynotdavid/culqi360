import { captureException } from "@sentry/bun";
import { createFlightDataCollector } from "@solidjs/router/server";
import { configureServerFunctionsServer } from "@solidjs/web/server-functions/server";

import { ActionError } from "~/contracts/errors";
import { faultMeta } from "~/shared/observability/fault-meta";
import { createLogger } from "~/shared/observability/runtime-logger";

import { Router } from "./router";

const SAFE_ERROR_MESSAGE = "No se pudo completar la solicitud.";

const logger = createLogger("server-function-fault");

/**
 * Maps a thrown value to what the caller is allowed to see. Response and
 * expected `ActionError` failures keep their wire payload so the client can
 * still branch on kind and code; anything else is reported and replaced, so
 * an internal fault never reaches the browser as a message.
 */
function toClientFault(thrown: unknown): unknown {
  if (thrown instanceof Response) {
    return thrown;
  }

  if (thrown instanceof ActionError && thrown.wire.kind !== "internal") {
    return thrown;
  }

  logger.error("server_function_fault", faultMeta(thrown));
  captureException(thrown);

  // Redacted, but still an ActionError: `wire` is an own property and survives
  // serialization, where a bare Error would arrive with only its message.
  return new ActionError({
    kind: "internal",
    code: null,
    message: SAFE_ERROR_MESSAGE,
  });
}

configureServerFunctionsServer({
  // The single-flight collector: a mutation response carries the refreshed
  // query data for the page the client is about to show, so the router seeds
  // its cache instead of refetching.
  collectFlightData: createFlightDataCollector(Router),

  // Solid 2 replaced SolidStart's `serverFunctions.onError` with this
  // per-invocation seam. It must stay transparent for synchronous direct
  // calls, so only the async path is wrapped in a promise.
  wrapInvocation: (run) => {
    try {
      const result = run();

      if (result instanceof Promise) {
        return result.catch((thrown: unknown) => {
          throw toClientFault(thrown);
        });
      }

      return result;
    } catch (thrown) {
      throw toClientFault(thrown);
    }
  },
});

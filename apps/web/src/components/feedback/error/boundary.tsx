import type { JSX } from "@solidjs/web";
import { Errored } from "solid-js";

import { createLogger } from "~/shared/observability/runtime-logger";

import { getErrorMessage, reportBoundaryError } from "./boundary-utils";
import { ErrorState } from "./state";

interface AppErrorBoundaryProps {
  children: JSX.Element;
  title?: string;
}

const logger = createLogger("app-error-boundary");

export function AppErrorBoundary(props: AppErrorBoundaryProps) {
  return (
    <Errored
      fallback={(error, reset) => {
        // Solid 2 hands the fallback an accessor rather than the value.
        const thrown = error();

        reportBoundaryError(logger, thrown);

        return (
          <ErrorState
            title={props.title}
            message={getErrorMessage(thrown)}
            onRetry={reset}
          />
        );
      }}
    >
      {props.children}
    </Errored>
  );
}

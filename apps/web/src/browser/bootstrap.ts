import { browserTracingIntegration, init } from "@sentry/browser";
import { isServer } from "@solidjs/web";

import { sentryDefaultDataCollection } from "../shared/observability/sentry";
import {
  isHydrationDiagnosticsEnabled,
  isHydrationMismatchError,
  traceHydrationEvent,
} from "./observability/diagnostics/hydration";
import { setupBrowserRequestSecurity } from "./security/csrf-client";

// Browser setup that must run before hydration begins. Imported for its side
// effects by App.tsx, because start mode generates the client entry and leaves
// no file to put this in. `isServer` is a build-time constant, so none of it
// reaches the SSR bundle.
const HYDRATION_SCOPE = "client-bootstrap";

function startSentry(): void {
  init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    // Router 2 navigates through the History API, which this integration
    // instruments directly. It replaces @sentry/solid's router integration,
    // which is pinned to Solid 1 and Router 0.x/1.x.
    integrations: [browserTracingIntegration()],
    tracesSampleRate: Number(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
    ),
    replaysSessionSampleRate: Number(
      import.meta.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE ?? "0.05",
    ),
    replaysOnErrorSampleRate: Number(
      import.meta.env.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE ?? "1.0",
    ),
    dataCollection: sentryDefaultDataCollection(),
  });

  // Replay is heavy and never needed for the first paint.
  void import("@sentry/browser").then(({ addIntegration, replayIntegration }) =>
    addIntegration(replayIntegration()),
  );
}

function startHydrationDiagnostics(): void {
  traceHydrationEvent(HYDRATION_SCOPE, "hydrate_start", {
    path: window.location.pathname,
    search: window.location.search,
  });

  window.addEventListener("error", (event) => {
    traceHydrationEvent(HYDRATION_SCOPE, "window_error", {
      message: event.message,
      hydrationMismatch:
        event.error instanceof Error && isHydrationMismatchError(event.error),
      error: event.error,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    traceHydrationEvent(HYDRATION_SCOPE, "unhandled_rejection", {
      hydrationMismatch: isHydrationMismatchError(event.reason),
      reason: event.reason,
    });
  });

  queueMicrotask(() => {
    traceHydrationEvent(HYDRATION_SCOPE, "hydrate_complete", {
      path: window.location.pathname,
      search: window.location.search,
    });
  });
}

if (!isServer) {
  if (import.meta.env.PROD) {
    startSentry();
  }

  setupBrowserRequestSecurity();

  if (isHydrationDiagnosticsEnabled(HYDRATION_SCOPE)) {
    startHydrationDiagnostics();
  }
}

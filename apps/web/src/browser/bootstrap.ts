import { browserTracingIntegration, init } from "@sentry/browser";
import { enableRichArguments } from "@solidjs/web/server-functions/rich-args";

import { sentryDefaultDataCollection } from "../shared/observability/sentry";
import {
  parseSentryBrowserConfig,
  SENTRY_BROWSER_CONFIG_META_NAME,
  type SentryBrowserConfig,
} from "../shared/observability/sentry-browser-config";
import {
  isHydrationDiagnosticsEnabled,
  isHydrationMismatchError,
  traceHydrationEvent,
} from "./observability/diagnostics/hydration";
import { setupBrowserRequestSecurity } from "./security/csrf-client";

// Browser setup that must run before hydration begins. Imported for its side
// effects by entry-client.tsx, ahead of the app, so the server bundle never
// loads it.
const HYDRATION_SCOPE = "client-bootstrap";

function readSentryConfig(): SentryBrowserConfig | null {
  const meta = document.querySelector<HTMLMetaElement>(
    `meta[name="${SENTRY_BROWSER_CONFIG_META_NAME}"]`,
  );

  return parseSentryBrowserConfig(meta?.content ?? null);
}

function startSentry(): void {
  const config = readSentryConfig();

  if (!config) {
    return;
  }

  init({
    dsn: config.dsn,
    // Router 2 navigates through the History API, which this integration
    // instruments directly. It replaces @sentry/solid's router integration,
    // which is pinned to Solid 1 and Router 0.x/1.x.
    integrations: [browserTracingIntegration()],
    tracesSampleRate: config.tracesSampleRate,
    replaysSessionSampleRate: config.replaysSessionSampleRate,
    replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
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

if (import.meta.env.PROD) {
  startSentry();
}

setupBrowserRequestSecurity();

// Server functions cannot encode `undefined` in their default JSON arguments.
// The rich-argument codec preserves optional fields and other non-JSON values
// at every call site.
enableRichArguments();

if (isHydrationDiagnosticsEnabled(HYDRATION_SCOPE)) {
  startHydrationDiagnostics();
}

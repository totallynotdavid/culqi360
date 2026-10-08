import type { RequestContext } from "~/server/platform/http/request-context-storage";
import type { SentryBrowserConfig } from "~/shared/observability/sentry-browser-config";

declare module "@solidjs/web" {
  interface RequestEventLocals {
    requestContext: RequestContext;
    /**
     * Seeded by the serving layer, which also hands it to `handleRequest` for
     * the injected client entry script. Absent in development, where the Vite
     * dev server owns that injection.
     */
    nonce?: string;
    /**
     * Seeded per request from the server environment and rendered into the
     * document head. Null when no Sentry DSN is configured.
     */
    sentryBrowserConfig?: SentryBrowserConfig | null;
  }
}

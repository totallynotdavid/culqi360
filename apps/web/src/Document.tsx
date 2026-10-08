import { getRequestEvent, HydrationScript, NoHydration } from "@solidjs/web";
import type { ParentProps } from "solid-js";

import favicon from "~/assets/images/logo/logo.ico";

import { CSRF_CONFIG } from "./shared/csrf-config";
import { SENTRY_BROWSER_CONFIG_META_NAME } from "./shared/observability/sentry-browser-config";

function requestCsrfToken(): string | null {
  const csrf = getRequestEvent()?.locals.requestContext?.csrf;
  return csrf?.kind === "available" ? csrf.token : null;
}

/**
 * The HTML shell wrapped around <App /> by Root.tsx.
 * Request-specific metadata and the client entry script live under
 * <NoHydration> because the browser has no request event when it renders this
 * tree.
 */
export default function Document(props: ParentProps) {
  const csrfToken = requestCsrfToken();
  const requestEvent = getRequestEvent();
  const sentryBrowserConfig = requestEvent?.locals.sentryBrowserConfig ?? null;

  return (
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <NoHydration>
          {csrfToken ? (
            <meta name={CSRF_CONFIG.META_NAME} content={csrfToken} />
          ) : null}
          {sentryBrowserConfig ? (
            <meta
              name={SENTRY_BROWSER_CONFIG_META_NAME}
              content={JSON.stringify(sentryBrowserConfig)}
            />
          ) : null}
          <script
            type="module"
            src="/src/entry-client.tsx"
            nonce={requestEvent?.locals.nonce}
            async
          />
        </NoHydration>
        <link rel="icon" type="image/x-icon" href={favicon} />
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}

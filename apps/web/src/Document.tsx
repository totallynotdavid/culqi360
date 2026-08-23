import { getRequestEvent, HydrationScript, NoHydration } from "@solidjs/web";
import type { ParentProps } from "solid-js";

import favicon from "~/assets/images/logo/logo.ico";

import { CSRF_CONFIG } from "./shared/csrf-config";

function requestCsrfToken(): string | null {
  const csrf = getRequestEvent()?.locals.requestContext?.csrf;
  return csrf?.kind === "available" ? csrf.token : null;
}

/**
 * The HTML shell wrapped around <App /> by the plugin's generated entries.
 * The client entry hydrates this same tree, so anything derived from the
 * request event lives under <NoHydration>: the browser has no request event
 * and would otherwise resolve the branch differently than the server did.
 */
export default function Document(props: ParentProps) {
  const csrfToken = requestCsrfToken();

  return (
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <NoHydration>
          {csrfToken ? (
            <meta name={CSRF_CONFIG.META_NAME} content={csrfToken} />
          ) : null}
        </NoHydration>
        <link rel="icon" type="image/x-icon" href={favicon} />
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}

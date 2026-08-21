import "~/instrument.server";
import "~/server/entrypoints/runtime-lifecycle";
import { getRequestEvent, redirect, type RequestEvent } from "@solidjs/web";
import { createAPIHandler } from "filesystem-routing/api";
import routes from "virtual:file-routes";

import { getApplication } from "./server/composition/application";
import { middlewareConfig } from "./server/platform/config/middleware-config";
import { enforceAuthRequest } from "./server/platform/http/request-auth";
import {
  buildAnonymousRequestContext,
  buildRequestContext,
} from "./server/platform/http/request-context-builder";
import { generateRequestId, generateTraceId } from "./shared/observability/ids";
import { isProduction } from "./shared/observability/runtime-env";

type Middleware = (
  request: Request,
  next: (request?: Request) => Response | Promise<Response>,
) => Response | Promise<Response>;

function requestEventOrThrow(): RequestEvent {
  const event = getRequestEvent();

  if (!event) {
    throw new Error("Middleware ran outside a request scope");
  }

  return event;
}

const identifyRequest: Middleware = (request, next) => {
  const event = requestEventOrThrow();
  const { trustedProxy } = middlewareConfig();

  // The serving layer mints the nonce because it also has to reach the client
  // entry script the handler injects, which is decided before middleware runs.
  // Absent in development, where the Vite dev server owns that injection.
  const nonce = event.locals.nonce ?? null;

  event.locals.requestContext = buildAnonymousRequestContext(
    request,
    {
      traceId: generateTraceId(),
      requestId: generateRequestId(),
      startedAt: new Date(), // clock-boundary: HTTP request arrival
      startedTicks: performance.now(),
      nonce: nonce ?? "",
    },
    trustedProxy,
  );

  return next();
};

const applySecurityResponseState: Middleware = (_request, next) => {
  const event = requestEventOrThrow();
  const { sentryIngestHost } = middlewareConfig();
  const nonce = event.locals.requestContext.nonce;

  const sentryConnectSrc = sentryIngestHost
    ? ` https://${sentryIngestHost}`
    : "";

  // Without a nonce the document was served by the Vite dev server, whose HMR
  // client and injected module preloads are inline and unhashable. Production
  // always has one, so the strict policy is what ships.
  const scriptSrc = nonce
    ? `'nonce-${nonce}' 'strict-dynamic'`
    : "'self' 'unsafe-inline' 'unsafe-eval'";

  const csp = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self' data:;
    connect-src 'self'${sentryConnectSrc};
    object-src 'none';
    frame-ancestors 'none';
    form-action 'self';
    base-uri 'none';
  `.replace(/\s+/g, " ");

  const headers = event.response.headers;

  headers.set("Content-Security-Policy", csp);
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );

  if (isProduction()) {
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains",
    );
  }

  return next();
};

const resolveSession: Middleware = async (request, next) => {
  const event = requestEventOrThrow();
  const current = event.locals.requestContext;
  const { trustedProxy } = middlewareConfig();

  event.locals.requestContext = await buildRequestContext(
    request,
    {
      traceId: current.traceId,
      requestId: current.requestId,
      startedAt: current.startedAt,
      startedTicks: current.startedTicks,
      nonce: current.nonce,
    },
    getApplication().http.requestContext,
    trustedProxy,
  );

  return next();
};

const enforceNavigationPolicy: Middleware = async (_request, next) => {
  const decision = await enforceAuthRequest(requestEventOrThrow());

  switch (decision.kind) {
    case "allow":
      return next();

    case "reject":
      return decision.response;

    case "redirect_login":
      return redirect("/login");

    case "redirect_onboarding":
      return redirect("/onboarding");

    case "redirect_recovery_setup":
      return redirect("/recovery-codes");

    case "redirect_home":
      return redirect(decision.to);

    default:
      return decision satisfies never;
  }
};

const recordRequestTiming: Middleware = async (_request, next) => {
  const { startedTicks } = requestEventOrThrow().locals.requestContext;
  const response = await next();
  const duration = Math.round(performance.now() - startedTicks);

  response.headers.set("Server-Timing", `app;dur=${duration}`);

  return response;
};

export default [
  identifyRequest,
  applySecurityResponseState,
  resolveSession,
  enforceNavigationPolicy,
  recordRequestTiming,

  // API routes are the GET/POST/... exports of modules under src/routes.
  // They run last so every request above has already been identified,
  // secured, session-resolved, and authorized.
  createAPIHandler(routes),
] satisfies Middleware[];

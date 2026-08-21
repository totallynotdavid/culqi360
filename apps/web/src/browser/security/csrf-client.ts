import { captureException } from "@sentry/browser";

import { ServerFunctionTransportError } from "~/contracts/errors";
import { CSRF_CONFIG } from "~/shared/csrf-config";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

export function setupBrowserRequestSecurity() {
  if (typeof window === "undefined" || !("fetch" in window)) {
    return;
  }

  const originalFetch = window.fetch;

  const patchedFetch = async (
    input: RequestInfo | URL,
    init: RequestInit | undefined,
  ): Promise<Response> => {
    const request = addCsrfToken(new Request(input, init));
    const response = await originalFetch(request);

    if (!isServerFunctionRequest(request) || response.ok) {
      return response;
    }

    const error = new ServerFunctionTransportError(response.status);
    captureException(error, {
      level: "warning",
      tags: { source: "server_function_transport" },
      extra: {
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
      },
    });
    throw error;
  };

  Object.assign(patchedFetch, originalFetch);

  // defineProperty keeps fetch configurable for downstream instrumentation
  // and bypasses the no-window-fetch-reassignment lint rule.
  Object.defineProperty(window, "fetch", {
    value: patchedFetch,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

function addCsrfToken(request: Request): Request {
  if (!needsCsrfToken(request)) {
    return request;
  }

  const token = getCsrfMetaToken();
  if (!token || request.headers.has(CSRF_CONFIG.HEADER_NAME)) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set(CSRF_CONFIG.HEADER_NAME, token);
  return new Request(request, { headers });
}

function needsCsrfToken(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return false;
  }
  return new URL(request.url).origin === window.location.origin;
}

function isServerFunctionRequest(request: Request): boolean {
  return new URL(request.url).pathname.endsWith("/_server");
}

function getCsrfMetaToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const meta = document.querySelector<HTMLMetaElement>(
    `meta[name="${CSRF_CONFIG.META_NAME}"]`,
  );
  return meta?.content ?? null;
}

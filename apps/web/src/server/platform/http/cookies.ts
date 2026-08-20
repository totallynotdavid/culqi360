import {
  type CookieOptions,
  getRequestEvent,
  parseCookieHeader,
  serializeCookie,
} from "@solidjs/web";

/**
 * The single cookie boundary for server code. Solid 2 owns the exchange (the
 * request's `Cookie` header in, the response stub's `Set-Cookie` headers out)
 * and the codec; everything above this reads and writes named cookies through
 * these three functions.
 *
 * Reads answer from the request that arrived, so a cookie written earlier in
 * the same request does not read back.
 */
function requestEvent() {
  const event = getRequestEvent();

  if (!event) {
    throw new Error(
      "Cookie access outside a request scope: call from middleware, a server function, or an API handler.",
    );
  }

  return event;
}

export function readCookie(name: string): string | undefined {
  return parseCookieHeader(requestEvent().request.headers.get("cookie"))[name];
}

export function writeCookie(
  name: string,
  value: string,
  options: CookieOptions,
): void {
  requestEvent().response.headers.append(
    "set-cookie",
    serializeCookie(name, value, options),
  );
}

export function expireCookie(name: string, options: CookieOptions): void {
  writeCookie(name, "", { ...options, maxAge: 0 });
}

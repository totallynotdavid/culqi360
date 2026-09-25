import { serializeCookie } from "@solidjs/web";

import {
  expireCookie,
  readCookie,
  writeCookie,
} from "~/server/platform/http/cookies";
import { isProduction } from "~/shared/observability/runtime-env";

/** Exported so tooling that hands out a preview session names the same cookie. */
export const SESSION_COOKIE_NAME = "session";
// Parks the administrator's own session token while they impersonate another
// user, so exiting impersonation can restore it.
const IMPERSONATOR_COOKIE_NAME = "impersonator_session";

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
  } as const;
}

export function getSessionCookie(): string | undefined {
  return readCookie(SESSION_COOKIE_NAME);
}

export function setSessionCookie(token: string): void {
  writeCookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: COOKIE_MAX_AGE,
  });
}

export function deleteSessionCookie(): void {
  expireCookie(SESSION_COOKIE_NAME, cookieOptions());
}

/**
 * Writes the session cookie onto a response the caller builds itself, for the
 * paths that return a `Response` instead of riding the request's response
 * stub.
 */
export function appendSessionCookie(headers: Headers, token: string): void {
  headers.append(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, token, {
      ...cookieOptions(),
      maxAge: COOKIE_MAX_AGE,
    }),
  );
}

export function getImpersonatorCookie(): string | undefined {
  return readCookie(IMPERSONATOR_COOKIE_NAME);
}

export function setImpersonatorCookie(token: string): void {
  writeCookie(IMPERSONATOR_COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: COOKIE_MAX_AGE,
  });
}

export function deleteImpersonatorCookie(): void {
  expireCookie(IMPERSONATOR_COOKIE_NAME, cookieOptions());
}

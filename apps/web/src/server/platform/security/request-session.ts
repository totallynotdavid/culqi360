import {
  expireCookie,
  readCookie,
  writeCookie,
} from "~/server/platform/http/cookies";
import { isProduction } from "~/shared/observability/runtime-env";

const COOKIE_NAME = "request_session";
const COOKIE_MAX_AGE = 60 * 60 * 24;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
  } as const;
}

export function getRequestSessionCookie(): string | undefined {
  return readCookie(COOKIE_NAME);
}

export function setRequestSessionCookie(id: string): void {
  writeCookie(COOKIE_NAME, id, {
    ...cookieOptions(),
    maxAge: COOKIE_MAX_AGE,
  });
}

export function deleteRequestSessionCookie(): void {
  expireCookie(COOKIE_NAME, cookieOptions());
}

export function getRequestSessionMaxAgeSeconds(): number {
  return COOKIE_MAX_AGE;
}

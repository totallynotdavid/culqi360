import { parseCookieHeader, serializeCookie } from "@solidjs/web";

import { isProduction } from "~/shared/observability/runtime-env";

const COOKIE_MAX_AGE = 600;
const STATE_COOKIE_NAME = "google_oauth_state";
const CODE_VERIFIER_COOKIE_NAME = "google_code_verifier";

export function readGoogleOAuthCookies(header: string | null): {
  state: string | null;
  codeVerifier: string | null;
} {
  const cookies = parseCookieHeader(header ?? "");
  return {
    state: cookies[STATE_COOKIE_NAME] ?? null,
    codeVerifier: cookies[CODE_VERIFIER_COOKIE_NAME] ?? null,
  };
}

export function appendGoogleOAuthChallengeCookies(
  headers: Headers,
  params: { state: string; codeVerifier: string },
): void {
  headers.append(
    "Set-Cookie",
    serializeCookie(STATE_COOKIE_NAME, params.state, {
      path: "/",
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    }),
  );
  headers.append(
    "Set-Cookie",
    serializeCookie(CODE_VERIFIER_COOKIE_NAME, params.codeVerifier, {
      path: "/",
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    }),
  );
}

export function appendClearedGoogleOAuthCookies(headers: Headers): void {
  headers.append(
    "Set-Cookie",
    serializeCookie(STATE_COOKIE_NAME, "", {
      path: "/",
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      maxAge: 0,
    }),
  );
  headers.append(
    "Set-Cookie",
    serializeCookie(CODE_VERIFIER_COOKIE_NAME, "", {
      path: "/",
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      maxAge: 0,
    }),
  );
}

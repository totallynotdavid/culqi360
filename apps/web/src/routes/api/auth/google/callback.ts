import type { APIEvent } from "filesystem-routing/api";

import {
  appendClearedGoogleOAuthCookies,
  readGoogleOAuthCookies,
} from "~/server/auth/google/google-oauth-cookies";
import { getClientIp } from "~/server/auth/password/client-ip";
import { appendSessionCookie } from "~/server/auth/session/cookies";
import { getApplication } from "~/server/composition/application";
import {
  getRequestContext,
  getRequestOperation,
} from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

function badRequest(): Response {
  return new Response("Bad request", { status: 400 });
}

function redirectToLogin(url: URL, error: string): Response {
  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("error", error);
  const clearHeaders = new Headers([["Location", loginUrl.toString()]]);
  appendClearedGoogleOAuthCookies(clearHeaders);
  return new Response(null, { status: 302, headers: clearHeaders });
}

export async function GET(event: APIEvent): Promise<Response> {
  const url = new URL(event.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthCookies = readGoogleOAuthCookies(
    event.request.headers.get("cookie"),
  );

  const ipAddress = getClientIp(event.request.headers);
  const userAgent = event.request.headers.get("user-agent") ?? null;
  const result = await getApplication().auth.login.completeGoogleOAuth(
    {
      code,
      state,
      storedState: oauthCookies.state,
      codeVerifier: oauthCookies.codeVerifier,
      ipAddress,
      userAgent,
    },
    getRequestContext().publicOrigin,
    getRequestOperation(),
  );
  if (isErr(result)) {
    if (result.error.kind === "bad_request") {
      return badRequest();
    }

    return redirectToLogin(url, result.error.error);
  }

  const responseHeaders = new Headers([
    ["Location", result.value.redirectPath],
  ]);
  if (result.value.sessionToken) {
    appendSessionCookie(responseHeaders, result.value.sessionToken);
  }
  appendClearedGoogleOAuthCookies(responseHeaders);

  return new Response(null, { status: 302, headers: responseHeaders });
}

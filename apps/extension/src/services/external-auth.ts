import {
  EXTENSION_SESSION_CLAIM_PATH,
  isClaimExtensionSessionResponse,
  isExtensionHandoffClaims,
  type ExtensionHandoffClaims,
} from "@crm/contracts/extension";

// Relative on purpose: apps/web tests import this file, and the `@/` alias
// resolves to the web app's root there.
import { Err, Ok, type Result } from "../domain/result";

export interface ClaimedHandoff {
  claims: ExtensionHandoffClaims;
  callId: string;
  sessionToken: string;
  refreshToken: string;
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Reads the claims for display only. The server verifies the signature and the
 * single-use token when it claims the handoff, so the extension holds no key.
 */
function decodeClaims(token: string): Result<ExtensionHandoffClaims, string> {
  const parts = token.split(".");
  const payload = parts[1];
  if (parts.length !== 3 || payload === undefined) {
    return Err("handoff token is not a token");
  }

  try {
    const claims: unknown = JSON.parse(fromBase64Url(payload));
    return isExtensionHandoffClaims(claims)
      ? Ok(claims)
      : Err("handoff token has invalid claims");
  } catch {
    return Err("handoff token is not readable");
  }
}

async function claimError(response: Response): Promise<string> {
  const fallback = `session claim failed with status ${response.status}`;
  try {
    const body: unknown = await response.json();
    const message =
      typeof body === "object" && body !== null
        ? Reflect.get(body, "error")
        : null;
    return typeof message === "string" && message !== ""
      ? `${fallback}: ${message}`
      : fallback;
  } catch {
    return fallback;
  }
}

export async function claimHandoff(input: {
  token: string;
  installationId: string;
  origin: string;
}): Promise<Result<ClaimedHandoff, string>> {
  const decoded = decodeClaims(input.token);
  if (!decoded.ok) {
    return decoded;
  }
  // The claim is posted to `input.origin`, so a token minted for another
  // origin must not go there.
  if (decoded.value.origin !== input.origin) {
    return Err("handoff token was issued for another origin");
  }

  let response: Response;
  try {
    response = await fetch(`${input.origin}${EXTENSION_SESSION_CLAIM_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        handoffToken: input.token,
        installationId: input.installationId,
      }),
    });
  } catch (error: unknown) {
    return Err(
      `session claim failed: ${error instanceof Error ? error.message : "network error"}`,
    );
  }
  if (!response.ok) {
    return Err(await claimError(response));
  }

  const body: unknown = await response.json().catch(() => null);
  if (!isClaimExtensionSessionResponse(body)) {
    return Err("session claim returned an invalid response");
  }

  return Ok({
    claims: decoded.value,
    callId: body.callId,
    sessionToken: body.sessionToken,
    refreshToken: body.refreshToken,
  });
}

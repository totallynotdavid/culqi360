import { EXTENSION_HANDOFF_TOKEN_ISSUER } from "@crm/contracts/extension";

import { UserId } from "~/domain/ids";
import { isErr } from "~/shared/result";

import {
  EXTENSION_SESSION_TOKEN_AUDIENCE,
  type ExtensionInstallationSessionClaims,
} from "../contracts";
import { ExtensionTokenVerificationError } from "../crypto";

export function isTokenExpired(expSeconds: number, expiredAsOf: Date): boolean {
  return expSeconds <= Math.floor(expiredAsOf.getTime() / 1000);
}

export function parseSubjectUserId(subject: string): UserId | null {
  if (!subject.startsWith("user:")) {
    return null;
  }

  const parsed = UserId.parse(subject.slice("user:".length));
  return isErr(parsed) ? null : parsed.value;
}

export function isExtensionInstallationSessionClaims(
  value: unknown,
): value is ExtensionInstallationSessionClaims {
  return (
    typeof value === "object" &&
    value !== null &&
    "iss" in value &&
    value.iss === EXTENSION_HANDOFF_TOKEN_ISSUER &&
    "aud" in value &&
    value.aud === EXTENSION_SESSION_TOKEN_AUDIENCE &&
    "sub" in value &&
    typeof value.sub === "string" &&
    "authSessionId" in value &&
    typeof value.authSessionId === "string" &&
    "branchId" in value &&
    typeof value.branchId === "string" &&
    "installationId" in value &&
    typeof value.installationId === "string" &&
    "jti" in value &&
    typeof value.jti === "string" &&
    "iat" in value &&
    typeof value.iat === "number" &&
    "exp" in value &&
    typeof value.exp === "number"
  );
}

export function isCryptoMisconfiguration(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("extension handoff") &&
    error.message.includes("key")
  );
}

export function isInvalidExtensionToken(error: unknown): boolean {
  return error instanceof ExtensionTokenVerificationError;
}

import { EXTENSION_HANDOFF_TOKEN_ISSUER } from "@crm/contracts/extension";

import {
  addMilliseconds,
  epochMilliseconds,
  epochSeconds,
} from "~/domain/time/clock";

import { EXTENSION_SESSION_TOKEN_AUDIENCE } from "../contracts";
import { hashExtensionSecretToken, signExtensionToken } from "../crypto";
import type { ExtensionRuntimeRepo } from "../repos";

const EXTENSION_INSTALLATION_SESSION_TTL_MS = 8 * 60 * 60_000;
const EXTENSION_ACCESS_TOKEN_TTL_MS = 15 * 60_000;

export type InstallationSessionRecord = NonNullable<
  Awaited<ReturnType<ExtensionRuntimeRepo["findValidInstallationSession"]>>
>;

export interface SessionCredentials {
  refreshToken: string;
  refreshTokenHash: string;
  sessionToken: string;
  expiresAt: number;
}

function accessTokenExpiresAt(issuedAt: Date): Date {
  return addMilliseconds(issuedAt, EXTENSION_ACCESS_TOKEN_TTL_MS);
}

export function installationSessionExpiresAt(issuedAt: Date): Date {
  return addMilliseconds(issuedAt, EXTENSION_INSTALLATION_SESSION_TTL_MS);
}

function generateRefreshToken(): string {
  return crypto.randomUUID();
}

async function signInstallationSessionToken(
  session: InstallationSessionRecord,
  issuedAt: Date,
): Promise<string> {
  const accessExpiresAt = accessTokenExpiresAt(issuedAt);

  return signExtensionToken({
    iss: EXTENSION_HANDOFF_TOKEN_ISSUER,
    aud: EXTENSION_SESSION_TOKEN_AUDIENCE,
    sub: `user:${session.user_id}`,
    authSessionId: session.auth_session_id,
    branchId: session.branch_id,
    installationId: session.installation_id,
    jti: session.jti,
    iat: epochSeconds(issuedAt),
    exp: epochSeconds(accessExpiresAt),
  });
}

export async function issueSessionCredentials(
  session: InstallationSessionRecord,
  issuedAt: Date,
): Promise<SessionCredentials> {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashExtensionSecretToken(refreshToken);
  const expiresAt = accessTokenExpiresAt(issuedAt);

  return {
    refreshToken,
    refreshTokenHash,
    sessionToken: await signInstallationSessionToken(session, issuedAt),
    expiresAt: epochMilliseconds(expiresAt),
  };
}

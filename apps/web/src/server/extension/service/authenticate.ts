import { external, fail, type DomainError } from "~/domain/errors";
import { Err, Ok, type Result } from "~/shared/result";

import { verifyExtensionToken } from "../crypto";
import { type ExtensionRepos, hasActiveAuthSession } from "./shared";
import type { InstallationSessionRecord } from "./tokens";
import {
  isCryptoMisconfiguration,
  isExtensionInstallationSessionClaims,
  isInvalidExtensionToken,
  isTokenExpired,
  parseSubjectUserId,
} from "./validators";

/**
 * Resolves a bearer session token to its installation session. Takes the root
 * repos on purpose: when the web login behind the session has ended, the
 * revocation and `reauth_required` flag must commit even though the request
 * fails, and inside a unit of work that returns an error they would roll back.
 */
export async function authenticateInstallationSession(
  repos: ExtensionRepos,
  sessionToken: string,
  at: Date,
): Promise<Result<InstallationSessionRecord, DomainError>> {
  try {
    const claims = await verifyExtensionToken(
      sessionToken,
      isExtensionInstallationSessionClaims,
    );
    if (isTokenExpired(claims.exp, at)) {
      return Err(fail("extension_session_invalid"));
    }

    const subjectUserId = parseSubjectUserId(claims.sub);
    const session = await repos.extensionRuntime.findValidInstallationSession(
      claims.jti,
      at,
    );
    if (
      !session ||
      !subjectUserId ||
      session.user_id !== subjectUserId ||
      session.branch_id !== claims.branchId ||
      session.auth_session_id !== claims.authSessionId ||
      session.installation_id !== claims.installationId
    ) {
      return Err(fail("extension_session_invalid"));
    }

    if (!(await hasActiveAuthSession(repos, session.auth_session_id, at))) {
      await repos.extensionRuntime.revokeInstallationSession(session.jti, at);
      await repos.extensionRuntime.updateExecutiveSyncHealthByUser({
        user_id: session.user_id,
        sync_health: "reauth_required",
        sync_updated_at: at,
      });
      return Err(fail("extension_session_invalid"));
    }

    await repos.extensionRuntime.touchInstallationSession(session.jti, at);
    return Ok(session);
  } catch (error: unknown) {
    if (isCryptoMisconfiguration(error)) {
      return Err(
        external("Extension token keys are not configured", {
          code: "misconfigured",
        }),
      );
    }
    if (isInvalidExtensionToken(error)) {
      return Err(fail("extension_session_invalid"));
    }
    throw error;
  }
}

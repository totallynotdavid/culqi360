import {
  EXTENSION_HANDOFF_TOKEN_AUDIENCE,
  EXTENSION_HANDOFF_TOKEN_ISSUER,
  isExtensionHandoffClaims,
  type ClaimExtensionSessionResponse,
} from "@crm/contracts/extension";

import { external, fail, invalid, type DomainError } from "~/domain/errors";
import { InstallationId } from "~/domain/ids";
import type { BranchId, ContactAssignmentId, UserId } from "~/domain/ids";
import {
  addMilliseconds,
  epochMilliseconds,
  epochSeconds,
} from "~/domain/time/clock";
import { extensionConfig } from "~/server/platform/config/env";
import type { AppUow } from "~/server/platform/database/uow";
import type { OperationContext } from "~/server/platform/operation/context";
import { Err, Ok, isErr, type Result } from "~/shared/result";

import { type CreateExtensionHandoffTokenResponse } from "../contracts";
import { signExtensionToken, verifyExtensionToken } from "../crypto";
import { upsertSyncHealth } from "./presence";
import { type ExtensionRepos, hasActiveAuthSession } from "./shared";
import {
  type InstallationSessionRecord,
  type SessionCredentials,
  installationSessionExpiresAt,
  issueSessionCredentials,
} from "./tokens";
import {
  isCryptoMisconfiguration,
  isInvalidExtensionToken,
  isTokenExpired,
  parseSubjectUserId,
} from "./validators";

const EXTENSION_HANDOFF_TTL_MS = 120_000;

interface HandoffMethodContext extends OperationContext {
  repos: ExtensionRepos;
  uow: AppUow<ExtensionRepos>;
}

export async function createHandoffToken(
  context: HandoffMethodContext,
  input: {
    userId: UserId;
    authSessionId: string;
    branchId: BranchId;
    assignmentId: ContactAssignmentId;
    origin: string;
  },
): Promise<Result<CreateExtensionHandoffTokenResponse, DomainError>> {
  const { repos } = context;

  if (input.assignmentId.trim() === "") {
    return Err(
      invalid({
        code: "assignment_id_required",
        details: { field: "assignment_id", rule: "required" },
      }),
    );
  }

  if (!input.origin) {
    return Err(invalid({ code: "origin_required" }));
  }

  const expectedOrigin = extensionConfig().extensionExpectedOrigin;

  if (input.origin !== expectedOrigin) {
    return Err(fail("handoff_origin_not_allowed"));
  }

  const assignmentId = input.assignmentId;

  try {
    const assignment = await repos.contactAssignments.findActiveByIdForUser(
      assignmentId,
      input.userId,
      context.operationAt,
    );

    if (!assignment) {
      return Err(fail("assignment_not_found"));
    }

    const contact = await repos.organization.findMembershipById(
      assignment.contact_id,
    );

    if (!contact) {
      return Err(fail("assignment_inactive"));
    }

    if (!contact.phone || contact.phone.trim() === "") {
      return Err(fail("assignment_inactive"));
    }

    const organization = await repos.organization.findOrganizationById(
      contact.organizationId,
    );
    const issuedAt = context.operationAt;
    const handoffExpiresAt = addMilliseconds(
      issuedAt,
      EXTENSION_HANDOFF_TTL_MS,
    );
    const handoffJti = crypto.randomUUID();

    const handoffToken = await signExtensionToken({
      iss: EXTENSION_HANDOFF_TOKEN_ISSUER,
      aud: EXTENSION_HANDOFF_TOKEN_AUDIENCE,
      sub: `user:${input.userId}`,
      authSessionId: input.authSessionId,
      branchId: input.branchId,
      assignmentId,
      contactId: contact.id,
      phone: contact.phone,
      clientName: contact.person.displayName,
      organizationLabel: organization ? `Org #${organization.id}` : null,
      action: "start_call",
      origin: input.origin,
      jti: handoffJti,
      iat: epochSeconds(issuedAt),
      exp: epochSeconds(handoffExpiresAt),
    });

    await repos.extensionRuntime.createHandoff({
      jti: handoffJti,
      user_id: input.userId,
      branch_id: input.branchId,
      auth_session_id: input.authSessionId,
      assignment_id: assignmentId,
      contact_id: contact.id,
      issued_at: issuedAt,
      expires_at: handoffExpiresAt,
      origin: input.origin,
    });

    return Ok({
      handoffToken,
      expiresAt: epochMilliseconds(handoffExpiresAt),
    });
  } catch (error: unknown) {
    if (isCryptoMisconfiguration(error)) {
      return Err(
        external("Extension token keys are not configured", {
          code: "misconfigured",
        }),
      );
    }

    return Err(
      external(
        error instanceof Error
          ? error.message
          : "Unexpected extension handoff failure",
        { code: "unexpected" },
      ),
    );
  }
}

export async function claimInstallationSession(
  context: HandoffMethodContext,
  input: {
    handoffToken: string;
    installationId: string;
  },
): Promise<Result<ClaimExtensionSessionResponse, DomainError>> {
  const { uow } = context;

  const installationId = InstallationId.parse(input.installationId);
  if (isErr(installationId)) {
    return Err(invalid({ code: "installation_invalid" }));
  }

  try {
    const claimedAt = context.operationAt;
    const handoffClaims = await verifyExtensionToken(
      input.handoffToken,
      isExtensionHandoffClaims,
    );

    if (isTokenExpired(handoffClaims.exp, claimedAt)) {
      return Err(fail("handoff_invalid"));
    }

    const userId = parseSubjectUserId(handoffClaims.sub);

    if (!userId) {
      return Err(fail("handoff_invalid"));
    }

    const claimResult = await uow.run(async (txRepos) => {
      const handoff = await txRepos.extensionRuntime.findHandoffByJti(
        handoffClaims.jti,
      );

      if (
        !handoff ||
        handoff.expires_at <= claimedAt ||
        handoff.origin !== handoffClaims.origin ||
        handoff.user_id !== userId ||
        handoff.branch_id !== handoffClaims.branchId ||
        handoff.auth_session_id !== handoffClaims.authSessionId ||
        handoff.assignment_id !== handoffClaims.assignmentId ||
        handoff.contact_id !== handoffClaims.contactId
      ) {
        return Err(fail("handoff_invalid"));
      }

      const authSessionActive = await hasActiveAuthSession(
        txRepos,
        handoff.auth_session_id,
        claimedAt,
      );

      if (!authSessionActive) {
        return Err(fail("handoff_invalid"));
      }

      let session: InstallationSessionRecord;
      let sessionCredentials: SessionCredentials | null = null;

      if (handoff.consumed_at !== null) {
        if (
          handoff.installation_id !== installationId.value ||
          !handoff.installation_session_jti
        ) {
          return Err(fail("handoff_claimed_by_other_installation"));
        }

        const existingSession =
          await txRepos.extensionRuntime.findValidInstallationSession(
            handoff.installation_session_jti,
            claimedAt,
          );

        if (!existingSession) {
          return Err(fail("handoff_invalid"));
        }

        session = existingSession;
      } else {
        const reusableSession =
          await txRepos.extensionRuntime.findActiveInstallationSession(
            handoff.auth_session_id,
            installationId.value,
            claimedAt,
          );
        const sessionJti = reusableSession?.jti ?? crypto.randomUUID();

        const consumeResult = await txRepos.extensionRuntime.consumeHandoff({
          jti: handoff.jti,
          installation_id: installationId.value,
          installation_session_jti: sessionJti,
          consumed_at: claimedAt,
        });

        if (Number(consumeResult.numUpdatedRows ?? 0) === 0) {
          const racedHandoff = await txRepos.extensionRuntime.findHandoffByJti(
            handoff.jti,
          );

          if (
            !racedHandoff ||
            racedHandoff.installation_id !== installationId.value ||
            !racedHandoff.installation_session_jti
          ) {
            return Err(fail("handoff_claimed_by_other_installation"));
          }

          const racedSession =
            await txRepos.extensionRuntime.findValidInstallationSession(
              racedHandoff.installation_session_jti,
              claimedAt,
            );

          if (!racedSession) {
            return Err(fail("handoff_invalid"));
          }

          session = racedSession;
        } else if (reusableSession) {
          session = reusableSession;
        } else {
          const newSession = {
            jti: sessionJti,
            user_id: handoff.user_id,
            branch_id: handoff.branch_id,
            auth_session_id: handoff.auth_session_id,
            installation_id: installationId.value,
            refresh_token_hash: "",
            issued_at: claimedAt,
            expires_at: installationSessionExpiresAt(claimedAt),
            revoked_at: null,
            last_seen_at: null,
            refreshed_at: claimedAt,
          } satisfies InstallationSessionRecord;

          sessionCredentials = await issueSessionCredentials(
            newSession,
            claimedAt,
          );

          await txRepos.extensionRuntime.createInstallationSession({
            jti: newSession.jti,
            user_id: newSession.user_id,
            branch_id: newSession.branch_id,
            auth_session_id: newSession.auth_session_id,
            installation_id: newSession.installation_id,
            refresh_token_hash: sessionCredentials.refreshTokenHash,
            issued_at: newSession.issued_at,
            expires_at: newSession.expires_at,
          });

          session = {
            ...newSession,
            refresh_token_hash: sessionCredentials.refreshTokenHash,
          };
        }
      }

      await txRepos.extensionRuntime.revokeOtherInstallationSessionsByUser(
        session.user_id,
        session.jti,
        claimedAt,
      );

      if (sessionCredentials === null) {
        sessionCredentials = await issueSessionCredentials(session, claimedAt);

        await txRepos.extensionRuntime.rotateInstallationSessionRefreshToken({
          jti: session.jti,
          refresh_token_hash: sessionCredentials.refreshTokenHash,
          refreshed_at: claimedAt,
          expires_at: installationSessionExpiresAt(claimedAt),
        });
      }

      await upsertSyncHealth(txRepos.extensionRuntime, {
        userId: session.user_id,
        branchId: session.branch_id,
        syncHealth: "ok",
        updatedAt: claimedAt,
      });

      await txRepos.extensionRecordings.insertCallIfAbsent({
        handoff_jti: handoff.jti,
        installation_id: session.installation_id,
        user_id: handoff.user_id,
        branch_id: handoff.branch_id,
        assignment_id: handoff.assignment_id,
        contact_id: handoff.contact_id,
        started_at: claimedAt,
      });
      const call = await txRepos.extensionRecordings.findCallByHandoffJti(
        handoff.jti,
      );
      if (!call) {
        throw new Error("extension call missing after insert");
      }

      return Ok({
        sessionToken: sessionCredentials.sessionToken,
        refreshToken: sessionCredentials.refreshToken,
        expiresAt: sessionCredentials.expiresAt,
        callId: call.id,
      });
    });

    return claimResult;
  } catch (error: unknown) {
    if (isCryptoMisconfiguration(error)) {
      return Err(
        external("Extension token keys are not configured", {
          code: "misconfigured",
        }),
      );
    }

    if (isInvalidExtensionToken(error)) {
      return Err(fail("handoff_invalid"));
    }

    return Err(
      external(
        error instanceof Error
          ? error.message
          : "Unexpected extension session claim failure",
        { code: "unexpected" },
      ),
    );
  }
}

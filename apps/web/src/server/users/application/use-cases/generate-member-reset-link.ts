import { auditEntityId } from "~/domain/audit/entity";
import { type DomainError } from "~/domain/errors";
import type { UserId } from "~/domain/ids";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "~/server/auth/password/reset-tokens";
import type { AppContext } from "~/server/platform/action/context";
import { isErr, Ok, type Result } from "~/shared/result";

import type { MemberWriteDeps } from "../ports";
import { authorizeMemberManagement } from "./authorize-member-management";

export interface MemberResetLink {
  resetUrl: string;
  expiresAt: Date;
}

// Administrators hand the link to the member themselves, so no email is sent
// and the plaintext token leaves the server only in this return value. The
// audit event records who generated it and for whom; it must never carry the
// token or the URL.
export async function generateMemberResetLink(
  ctx: AppContext,
  deps: MemberWriteDeps & { publicOrigin: string },
  userId: UserId,
): Promise<Result<MemberResetLink, DomainError>> {
  return deps.lifecycle.run(async (tx) => {
    const target = await authorizeMemberManagement(ctx, tx.users, userId);
    if (isErr(target)) {
      return target;
    }

    // One live reset link per member: a new link retires every earlier one,
    // including any the member requested through forgot password.
    await tx.passwordResetTokens.expireAllForUser(userId, ctx.operationAt);

    const token = generatePasswordResetToken();
    const expiresAt = new Date(
      ctx.operationAt.getTime() + PASSWORD_RESET_TOKEN_TTL_MS,
    );
    await tx.passwordResetTokens.create({
      user_id: userId,
      token_hash: hashPasswordResetToken(token),
      expires_at: expiresAt,
      created_at: ctx.operationAt,
    });
    await tx.events.append({
      type: "password_reset_link_generated",
      entityType: "user",
      entityId: auditEntityId("user", userId),
      actorUserId: ctx.actor.userId,
      subjectUserId: userId,
      occurredAt: ctx.operationAt,
    });

    // The admin copies this URL off the proxy-facing host, so it must use the
    // configured public origin, not whatever proto the proxy forwarded.
    return Ok({
      resetUrl: `${deps.publicOrigin}/reset-password?token=${token}`,
      expiresAt,
    });
  });
}

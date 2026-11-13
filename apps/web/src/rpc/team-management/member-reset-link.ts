import { UserId } from "~/domain/ids";
import { getApplication } from "~/server/composition/application";
import { executeSessionServerFunction } from "~/server/platform/action";
import {
  parseObject,
  validationFail,
} from "~/server/platform/action/input-reader";
import { isErr, Ok } from "~/shared/result";

export async function generateMemberResetLink(
  rawUserId: unknown,
): Promise<{ resetUrl: string; expiresAt: string }> {
  "use server";

  return executeSessionServerFunction({
    name: "members.reset_link.generate",
    access: { kind: "permission", permission: "team:manage" },

    parse: () =>
      parseObject({ userId: rawUserId }, validationFail, (r) => ({
        userId: r.id("userId", UserId),
      })),

    telemetry: ({ userId }) => ({ userId }),

    execute: async (ctx, { userId }) => {
      const result = await getApplication().users.members.generateResetLink(
        ctx,
        userId,
      );

      if (isErr(result)) {
        return result;
      }

      return Ok({
        resetUrl: result.value.resetUrl,
        expiresAt: result.value.expiresAt.toISOString(),
      });
    },
  });
}

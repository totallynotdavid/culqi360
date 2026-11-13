import type { Kysely } from "kysely";

import { createAccessSecurityTx } from "~/server/auth/infrastructure/session-revocation-context";
import { createPasswordResetTokensRepo } from "~/server/auth/repos-password-reset";
import type { Database } from "~/server/platform/database/types";
import { createExecutorUow } from "~/server/platform/database/uow";
import type { MemberWriteDeps } from "~/server/users/application/ports";
import { createMemberWorkloadRepo } from "~/server/users/repos-member-workload";
import { createUsersRepo } from "~/server/users/repos-users";

export function createMemberWriteContext(
  db: Kysely<Database>,
): MemberWriteDeps {
  return {
    users: createUsersRepo(db),
    lifecycle: createExecutorUow(db, (tx) => ({
      ...createAccessSecurityTx(tx),
      workload: createMemberWorkloadRepo(tx),
      passwordResetTokens: createPasswordResetTokensRepo(tx),
    })),
  };
}

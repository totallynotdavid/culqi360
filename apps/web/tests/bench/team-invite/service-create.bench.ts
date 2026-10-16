import { operationAt } from "@tests/support/operation";
import { TEST_FIXTURES } from "@tests/support/runtime/db";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { BranchId, UserId } from "~/domain/ids";
import type { InviteService } from "~/server/invites/application/types";
import { createInviteServiceForExecutor } from "~/server/invites/infrastructure/invite-service-factory";

import { BENCH_NOW } from "../_shared/constants";
import { createBenchDbFixture } from "../_shared/fixture";
import { SINGLE_CALL } from "../_shared/options";
import { freshInviteEmail } from "./fixtures";

describe("team invite create benchmark", () => {
  const db = createBenchDbFixture("bench-team-invite-create");
  let inviteCreate!: (
    input: Parameters<InviteService["createInvite"]>[0],
  ) => ReturnType<InviteService["createInvite"]>;
  let email = "";
  const actorUserId = UserId.trust(TEST_FIXTURES.users.superUser.id);
  const branchId = BranchId.trust(TEST_FIXTURES.branches.norte.id);

  beforeAll(async () => {
    const ctx = await db.setup();
    const inviteService = createInviteServiceForExecutor(ctx.db);
    inviteCreate = (input) =>
      inviteService.createInvite(input, operationAt(BENCH_NOW));
  });

  afterAll(async () => {
    await db.teardown();
  });

  test("service path: create invite", async ({ bench }) => {
    const result = await bench(
      "service path: create invite",
      {
        beforeEach: () => {
          email = freshInviteEmail();
        },
      },
      async () => {
        const createResult = await inviteCreate({
          actorUserId,
          actorRole: "superuser",
          branchId,
          names: "Bench Create",
          firstSurname: "User",
          secondSurname: "Bench",
          email,
          role: "executive",
          executiveCategory: "elite",
          teamId: null,
        });

        if (!createResult.ok) {
          throw new Error(
            `expected invite create success, got ${createResult.error.code ?? createResult.error.kind}`,
          );
        }
      },
    ).run(SINGLE_CALL);
    expect(result.state).toBe("completed");
  });
});

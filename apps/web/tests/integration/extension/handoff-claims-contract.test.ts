import { isExtensionHandoffClaims } from "@crm/contracts/extension";
import { createExtensionScenario } from "@tests/support/extension/api";
import { createExtensionFixture } from "@tests/support/extension/fixture";
import { operationAt } from "@tests/support/operation";
import {
  cleanupTestDb,
  resetTestDb,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const WEB_ORIGIN = "http://localhost:3000";

function decodeTokenClaims(token: string): unknown {
  const payload = token.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

describe("extension handoff token contract", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createExtensionFixture("extension-handoff-claims-contract");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  it("signs claims that satisfy the shared handoff claims guard", async () => {
    const scenario = createExtensionScenario(ctx);
    const authSessionId = await scenario.session();
    const assignmentId = await scenario.assignment();
    const result = await scenario.service.createHandoffToken(
      {
        userId: ctx.fixtures.users.execOne.id,
        authSessionId,
        branchId: ctx.fixtures.branches.lima.id,
        assignmentId,
        origin: WEB_ORIGIN,
      },
      operationAt(new Date()),
    );
    if (!result.ok) {
      throw new Error(result.error.code ?? result.error.kind);
    }

    expect(
      isExtensionHandoffClaims(decodeTokenClaims(result.value.handoffToken)),
    ).toBe(true);
  });
});

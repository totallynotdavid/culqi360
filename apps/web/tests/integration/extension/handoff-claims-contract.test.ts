import { isExtensionHandoffClaims } from "@crm/contracts/extension";
import { createExtensionScenario } from "@tests/support/extension/api";
import { createExtensionFixture } from "@tests/support/extension/fixture";
import { operationAt } from "@tests/support/operation";
import {
  cleanupTestDb,
  resetTestDb,
  type TestDbContext,
} from "@tests/support/runtime/db";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { verifyExternalHandoff } from "../../../../extension/src/services/external-auth";

const WEB_ORIGIN = "http://localhost:3000";
const ED25519_SPKI_PREFIX_BYTES = 12;

function decodeTokenClaims(token: string): unknown {
  const payload = token.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

// The extension is built with the raw 32-byte public key; the server config
// holds the same key as SPKI DER.
function rawPublicKeyBase64Url(): string {
  const spki = Buffer.from(
    process.env.EXTENSION_HANDOFF_PUBLIC_KEY_SPKI_BASE64 ?? "",
    "base64",
  );
  return spki.subarray(ED25519_SPKI_PREFIX_BYTES).toString("base64url");
}

describe("extension handoff token contract", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createExtensionFixture("extension-handoff-claims-contract");
    vi.stubEnv("VITE_CRM_WEB_ORIGIN", WEB_ORIGIN);
    vi.stubEnv(
      "VITE_CRM_HANDOFF_PUBLIC_KEY_RAW_BASE64",
      rawPublicKeyBase64Url(),
    );
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  async function signHandoff() {
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
    return { token: result.value.handoffToken, assignmentId };
  }

  it("signs claims that satisfy the shared handoff claims guard", async () => {
    const { token } = await signHandoff();

    expect(isExtensionHandoffClaims(decodeTokenClaims(token))).toBe(true);
  });

  it("signs a token the extension's own verification accepts", async () => {
    const { token, assignmentId } = await signHandoff();

    const verified = await verifyExternalHandoff({
      token,
      sender: { url: `${WEB_ORIGIN}/crm` },
    });

    expect(verified.origin).toBe(WEB_ORIGIN);
    expect(verified.handoff.assignmentId).toBe(assignmentId);
    expect(verified.handoff.contactId).toBe(
      ctx.fixtures.organizationPeople.lima.id,
    );
  });
});

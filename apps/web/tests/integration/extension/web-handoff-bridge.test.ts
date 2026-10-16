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
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { handoffLeadToExtension } from "~/features/extension/runtime";

import { verifyExternalHandoff } from "../../../../extension/src/services/external-auth";

const WEB_ORIGIN = "http://localhost:3000";
const ED25519_SPKI_PREFIX_BYTES = 12;

function rawPublicKeyBase64Url(): string {
  const spki = Buffer.from(
    process.env.EXTENSION_HANDOFF_PUBLIC_KEY_SPKI_BASE64 ?? "",
    "base64",
  );
  return spki.subarray(ED25519_SPKI_PREFIX_BYTES).toString("base64url");
}

async function extensionReply(token: string, senderUrl: string) {
  try {
    const verified = await verifyExternalHandoff({
      token,
      sender: { url: senderUrl },
    });
    return {
      ok: true,
      executiveState: {
        presenceStatus: "ready",
        syncHealth: "ok",
        assignmentId: verified.handoff.assignmentId,
        contactId: verified.handoff.contactId,
        phone: verified.handoff.phone,
        presenceUpdatedAt: Date.now(),
        syncUpdatedAt: Date.now(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Simulate `onMessageExternal`; token verification remains the extension code.
function installExtension(senderUrl: string) {
  const runtime = {
    lastError: undefined,
    sendMessage: async (
      _extensionId: string,
      message: { token: string },
      callback: (response?: unknown) => void,
    ) => {
      callback(await extensionReply(message.token, senderUrl));
    },
  };
  Object.assign(globalThis, { chrome: { runtime } });
}

describe("web handoff to the extension", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createExtensionFixture("extension-web-handoff-bridge");
    vi.stubEnv("VITE_CRM_WEB_ORIGIN", WEB_ORIGIN);
    vi.stubEnv(
      "VITE_CRM_HANDOFF_PUBLIC_KEY_RAW_BASE64",
      rawPublicKeyBase64Url(),
    );
    vi.stubEnv("VITE_CRM_EXTENSION_ID", "ext-test");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "chrome");
  });

  async function signHandoffToken() {
    const scenario = createExtensionScenario(ctx);
    const assignmentId = await scenario.assignment();
    const result = await scenario.service.createHandoffToken(
      {
        userId: ctx.fixtures.users.execOne.id,
        authSessionId: await scenario.session(),
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

  it("is accepted when a server-signed token reaches the extension from the web origin", async () => {
    const { token, assignmentId } = await signHandoffToken();
    installExtension(`${WEB_ORIGIN}/me/assignments`);

    const outcome = await handoffLeadToExtension({ token });

    expect(outcome).toMatchObject({
      status: "accepted",
      executiveState: { assignmentId },
    });
  });

  it("is refused with the extension's reason when another origin sends the token", async () => {
    const { token } = await signHandoffToken();
    installExtension("https://evil.example/me/assignments");

    const outcome = await handoffLeadToExtension({ token });

    expect(outcome).toEqual({
      status: "refused",
      reason: "untrusted sender origin",
    });
  });
});

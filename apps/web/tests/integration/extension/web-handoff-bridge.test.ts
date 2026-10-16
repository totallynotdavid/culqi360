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

import { claimHandoff } from "../../../../extension/src/services/external-auth";

const WEB_ORIGIN = "http://localhost:3000";

// The extension's own claim code runs here; only its HTTP call is answered by
// the real claim service instead of a network.
function serveClaimsFrom(
  service: ReturnType<typeof createExtensionScenario>["service"],
) {
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    const body: { handoffToken: string; installationId: string } = JSON.parse(
      init.body,
    );
    const claimed = await service.claimInstallationSession(
      body,
      operationAt(new Date()),
    );
    if (!claimed.ok) {
      return Response.json(
        { error: claimed.error.code ?? claimed.error.kind },
        { status: 401 },
      );
    }
    return Response.json(claimed.value);
  });
}

async function extensionReply(token: string, senderUrl: string) {
  const claimed = await claimHandoff({
    token,
    installationId: crypto.randomUUID(),
    origin: new URL(senderUrl).origin,
  });
  if (!claimed.ok) {
    return { ok: false, error: claimed.error };
  }
  return {
    ok: true,
    executiveState: {
      presenceStatus: "ready",
      syncHealth: "ok",
      assignmentId: claimed.value.claims.assignmentId,
      contactId: claimed.value.claims.contactId,
      phone: claimed.value.claims.phone,
      presenceUpdatedAt: Date.now(),
      syncUpdatedAt: Date.now(),
    },
  };
}

// Simulates `onMessageExternal`.
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
    vi.unstubAllGlobals();
  });

  async function signHandoffToken() {
    const scenario = createExtensionScenario(ctx);
    serveClaimsFrom(scenario.service);
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
      reason: "handoff token was issued for another origin",
    });
  });
});

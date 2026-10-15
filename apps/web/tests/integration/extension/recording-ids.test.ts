import { EXTENSION_SEGMENT_CHANNEL_LAYOUT } from "@crm/contracts/extension";
import { expectErr, expectOk } from "@tests/support/_core/assertions";
import { createExtensionScenario } from "@tests/support/extension/api";
import { createExtensionFixture } from "@tests/support/extension/fixture";
import { operationAt } from "@tests/support/operation";
import {
  cleanupTestDb,
  resetTestDb,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ExtensionCallId } from "~/domain/ids";

const INSTALLATION_ONE = "11111111-1111-4111-8111-111111111111";
const INSTALLATION_TWO = "22222222-2222-4222-8222-222222222222";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function putWith(scenario: ReturnType<typeof createExtensionScenario>) {
  return (sessionToken: string, recordingId: string, seq: number) =>
    scenario.service.putSegment(
      {
        sessionToken,
        recordingId,
        seq,
        contentType: "audio/webm;codecs=opus",
        channels: EXTENSION_SEGMENT_CHANNEL_LAYOUT,
        startedAt: Date.UTC(2026, 9, 1, 15, 0, seq),
        readBody: () => Promise.resolve(Uint8Array.of(seq + 1)),
      },
      operationAt(new Date()),
    );
}

function sessionJti(sessionToken: string): string {
  const payload = sessionToken.split(".")[1] ?? "";
  const claims: unknown = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  );
  if (
    typeof claims !== "object" ||
    claims === null ||
    !("jti" in claims) ||
    typeof claims.jti !== "string"
  ) {
    throw new Error("session token has no jti claim");
  }
  return claims.jti;
}

describe("extension server-minted call and recording ids", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createExtensionFixture("extension-recording-ids");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  it("returns a callId the server created for the claimed handoff", async () => {
    const scenario = createExtensionScenario(ctx);

    const { callId, assignmentId } = await scenario.claim(INSTALLATION_ONE);

    expect(callId).toMatch(UUID);
    const call = await ctx.db
      .selectFrom("extension_calls")
      .selectAll()
      .where("id", "=", ExtensionCallId.trust(callId))
      .executeTakeFirstOrThrow();
    expect(call.assignment_id).toBe(assignmentId);
    expect(call.user_id).toBe(ctx.fixtures.users.execOne.id);
    expect(call.ended_at).toBeNull();
  });

  it("returns the same callId when the same handoff is claimed again", async () => {
    const scenario = createExtensionScenario(ctx);
    const first = await scenario.claim(INSTALLATION_ONE);

    const again = expectOk(
      await scenario.service.claimInstallationSession(
        {
          handoffToken: first.handoffToken,
          installationId: INSTALLATION_ONE,
        },
        operationAt(new Date()),
      ),
    );

    expect(again.callId).toBe(first.callId);
    const calls = await ctx.db
      .selectFrom("extension_calls")
      .select("id")
      .execute();
    expect(calls).toHaveLength(1);
  });

  it("creates a recording for the call and returns the same one on retry", async () => {
    const scenario = createExtensionScenario(ctx);
    const { sessionToken, callId } = await scenario.claim(INSTALLATION_ONE);

    const first = expectOk(
      await scenario.service.createRecording(
        { sessionToken, callId },
        operationAt(new Date()),
      ),
    );
    const retry = expectOk(
      await scenario.service.createRecording(
        { sessionToken, callId },
        operationAt(new Date()),
      ),
    );

    expect(first.recordingId).toMatch(UUID);
    expect(retry.recordingId).toBe(first.recordingId);
  });

  it("hides a call from another installation session", async () => {
    const scenario = createExtensionScenario(ctx);
    const owner = await scenario.claim(INSTALLATION_ONE, "execOne");
    const other = await scenario.claim(INSTALLATION_TWO, "execTwo");

    const error = expectErr(
      await scenario.service.createRecording(
        { sessionToken: other.sessionToken, callId: owner.callId },
        operationAt(new Date()),
      ),
    );

    expect(error.code).toBe("call_not_found");
  });

  it("rejects a callId the server never minted", async () => {
    const scenario = createExtensionScenario(ctx);
    const { sessionToken } = await scenario.claim(INSTALLATION_ONE);

    const unknown = expectErr(
      await scenario.service.createRecording(
        { sessionToken, callId: crypto.randomUUID() },
        operationAt(new Date()),
      ),
    );
    const malformed = expectErr(
      await scenario.service.createRecording(
        { sessionToken, callId: "my-own-call-id" },
        operationAt(new Date()),
      ),
    );

    expect(unknown.code).toBe("call_not_found");
    expect(malformed.code).toBe("invalid_extension_call_id");
  });

  it("lets a new session of the same installation finish a recording the old session started", async () => {
    const scenario = createExtensionScenario(ctx);
    const put = putWith(scenario);
    const first = await scenario.claim(INSTALLATION_ONE);
    const { recordingId } = expectOk(
      await scenario.service.createRecording(
        { sessionToken: first.sessionToken, callId: first.callId },
        operationAt(new Date()),
      ),
    );
    expectOk(await put(first.sessionToken, recordingId, 0));
    await ctx.repos.extensionRuntime.revokeInstallationSession(
      sessionJti(first.sessionToken),
      new Date(),
    );
    expect(expectErr(await put(first.sessionToken, recordingId, 1)).code).toBe(
      "extension_session_invalid",
    );

    const second = await scenario.claim(INSTALLATION_ONE);
    expect(second.sessionToken).not.toBe(first.sessionToken);
    expectOk(await put(second.sessionToken, recordingId, 1));
    const closed = expectOk(
      await scenario.service.closeRecording(
        {
          sessionToken: second.sessionToken,
          recordingId,
          segments: 2,
          bytes: 2,
          interrupted: false,
        },
        operationAt(new Date()),
      ),
    );

    expect(closed).toEqual({ status: "complete", segments: 2, bytes: 2 });
  });

  it("hides a recording from the same user on another installation", async () => {
    const scenario = createExtensionScenario(ctx);
    const put = putWith(scenario);
    const owner = await scenario.claim(INSTALLATION_ONE);
    const { recordingId } = expectOk(
      await scenario.service.createRecording(
        { sessionToken: owner.sessionToken, callId: owner.callId },
        operationAt(new Date()),
      ),
    );
    const elsewhere = await scenario.claim(INSTALLATION_TWO);

    const error = expectErr(await put(elsewhere.sessionToken, recordingId, 0));

    expect(error.code).toBe("recording_not_found");
  });

  it("rejects a recording request without a valid session", async () => {
    const scenario = createExtensionScenario(ctx);
    const { callId } = await scenario.claim(INSTALLATION_ONE);

    const error = expectErr(
      await scenario.service.createRecording(
        { sessionToken: "not-a-jwt", callId },
        operationAt(new Date()),
      ),
    );

    expect(error.code).toBe("extension_session_invalid");
  });
});

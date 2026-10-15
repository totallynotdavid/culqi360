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

const INSTALLATION_ONE = "11111111-1111-4111-8111-111111111111";
const INSTALLATION_TWO = "22222222-2222-4222-8222-222222222222";

async function openRecording(
  scenario: ReturnType<typeof createExtensionScenario>,
  installationId = INSTALLATION_ONE,
  executive: "execOne" | "execTwo" = "execOne",
) {
  const { sessionToken, callId } = await scenario.claim(
    installationId,
    executive,
  );
  const { recordingId } = expectOk(
    await scenario.service.createRecording(
      { sessionToken, callId },
      operationAt(new Date()),
    ),
  );
  return { sessionToken, callId, recordingId };
}

async function upload(
  scenario: ReturnType<typeof createExtensionScenario>,
  open: { sessionToken: string; recordingId: string },
  seq: number,
  size: number,
) {
  expectOk(
    await scenario.service.putSegment(
      {
        sessionToken: open.sessionToken,
        recordingId: open.recordingId,
        seq,
        contentType: "audio/webm;codecs=opus",
        channels: EXTENSION_SEGMENT_CHANNEL_LAYOUT,
        startedAt: Date.UTC(2026, 9, 1, 15, 0, seq),
        readBody: () => Promise.resolve(new Uint8Array(size).fill(seq + 1)),
      },
      operationAt(new Date()),
    ),
  );
}

function close(
  scenario: ReturnType<typeof createExtensionScenario>,
  open: { sessionToken: string; recordingId: string },
  manifest: { segments: number; bytes: number; interrupted?: boolean },
  at = new Date(),
) {
  return scenario.service.closeRecording(
    {
      sessionToken: open.sessionToken,
      recordingId: open.recordingId,
      segments: manifest.segments,
      bytes: manifest.bytes,
      interrupted: manifest.interrupted ?? false,
    },
    operationAt(at),
  );
}

describe("extension recording close", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createExtensionFixture("extension-recording-close");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  it("lists the missing seqs and leaves the recording open", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    await upload(scenario, open, 0, 10);
    await upload(scenario, open, 3, 10);

    const result = expectOk(
      await close(scenario, open, { segments: 5, bytes: 50 }),
    );

    expect(result).toEqual({ status: "missing", missing: [1, 2, 4] });
    const recording = await ctx.db
      .selectFrom("extension_recordings")
      .select(["status", "closed_at"])
      .executeTakeFirstOrThrow();
    expect(recording).toEqual({ status: "open", closed_at: null });
    const call = await ctx.db
      .selectFrom("extension_calls")
      .select("ended_at")
      .executeTakeFirstOrThrow();
    expect(call.ended_at).toBeNull();
  });

  it("answers complete once segments 0..n-1 are stored, whatever order they arrived in", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    await upload(scenario, open, 2, 30);
    await upload(scenario, open, 0, 10);
    expect(
      expectOk(await close(scenario, open, { segments: 3, bytes: 60 })),
    ).toEqual({ status: "missing", missing: [1] });
    await upload(scenario, open, 1, 20);

    const result = expectOk(
      await close(scenario, open, { segments: 3, bytes: 60 }),
    );

    expect(result).toEqual({ status: "complete", segments: 3, bytes: 60 });
    const recording = await ctx.db
      .selectFrom("extension_recordings")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(recording.status).toBe("complete");
    expect(recording.closed_at).not.toBeNull();
    expect(recording.reported_interrupted).toBe(false);
    expect(recording.expected_segments).toBe(3);
    expect(recording.expected_bytes).toBe(60);
    const call = await ctx.db
      .selectFrom("extension_calls")
      .select("ended_at")
      .executeTakeFirstOrThrow();
    expect(call.ended_at).not.toBeNull();
  });

  it("records an interrupted recording that still has every segment as complete", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    await upload(scenario, open, 0, 10);

    const result = expectOk(
      await close(scenario, open, {
        segments: 1,
        bytes: 10,
        interrupted: true,
      }),
    );

    expect(result.status).toBe("complete");
    const recording = await ctx.db
      .selectFrom("extension_recordings")
      .select(["status", "reported_interrupted"])
      .executeTakeFirstOrThrow();
    expect(recording).toEqual({
      status: "complete",
      reported_interrupted: true,
    });
  });

  it("refuses to complete when the stored bytes differ from the manifest", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    await upload(scenario, open, 0, 10);
    await upload(scenario, open, 1, 10);

    const error = expectErr(
      await close(scenario, open, { segments: 2, bytes: 21 }),
    );

    expect(error.code).toBe("recording_manifest_mismatch");
    const recording = await ctx.db
      .selectFrom("extension_recordings")
      .select("closed_at")
      .executeTakeFirstOrThrow();
    expect(recording.closed_at).toBeNull();
  });

  it("ignores segments beyond the manifest count", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    await upload(scenario, open, 0, 10);
    await upload(scenario, open, 7, 99);

    const result = expectOk(
      await close(scenario, open, { segments: 1, bytes: 10 }),
    );

    expect(result).toEqual({ status: "complete", segments: 1, bytes: 10 });
  });

  it("answers complete again for a repeated close and keeps the first close time", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    await upload(scenario, open, 0, 10);
    const firstClose = new Date(Date.now() + 1000);
    expectOk(
      await close(scenario, open, { segments: 1, bytes: 10 }, firstClose),
    );

    const again = expectOk(
      await close(
        scenario,
        open,
        { segments: 1, bytes: 10 },
        new Date(firstClose.getTime() + 60_000),
      ),
    );

    expect(again.status).toBe("complete");
    const recording = await ctx.db
      .selectFrom("extension_recordings")
      .select("closed_at")
      .executeTakeFirstOrThrow();
    expect(recording.closed_at?.getTime()).toBe(firstClose.getTime());
  });

  it("hides a recording from another installation session", async () => {
    const scenario = createExtensionScenario(ctx);
    const owner = await openRecording(scenario, INSTALLATION_ONE, "execOne");
    const other = await openRecording(scenario, INSTALLATION_TWO, "execTwo");

    const error = expectErr(
      await close(
        scenario,
        { sessionToken: other.sessionToken, recordingId: owner.recordingId },
        { segments: 0, bytes: 0 },
      ),
    );

    expect(error.code).toBe("recording_not_found");
  });

  it("does not count an incomplete close as activity", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    const activity = () =>
      ctx.db
        .selectFrom("extension_recordings")
        .select("last_activity_at")
        .executeTakeFirstOrThrow();
    const before = await activity();
    const later = new Date(before.last_activity_at.getTime() + 5 * 60_000);

    expectOk(await close(scenario, open, { segments: 2, bytes: 4 }, later));

    expect((await activity()).last_activity_at).toEqual(
      before.last_activity_at,
    );
  });

  it("refuses a repeated close whose manifest differs from the one that completed it", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    await upload(scenario, open, 0, 10);
    expectOk(await close(scenario, open, { segments: 1, bytes: 10 }));

    const error = expectErr(
      await close(scenario, open, { segments: 2, bytes: 20 }),
    );

    expect(error.code).toBe("recording_manifest_mismatch");
    const recording = await ctx.db
      .selectFrom("extension_recordings")
      .select(["status", "expected_segments"])
      .executeTakeFirstOrThrow();
    expect(recording).toEqual({ status: "complete", expected_segments: 1 });
  });
});

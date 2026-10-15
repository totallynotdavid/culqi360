import {
  EXTENSION_SEGMENT_CHANNEL_LAYOUT,
  type CloseRecordingResponse,
} from "@crm/contracts/extension";
import { expectOk } from "@tests/support/_core/assertions";
import {
  createExtensionScenario,
  rejectingUow,
} from "@tests/support/extension/api";
import { createExtensionFixture } from "@tests/support/extension/fixture";
import { operationAt } from "@tests/support/operation";
import {
  cleanupTestDb,
  resetTestDb,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ExtensionRecordingId } from "~/domain/ids";
import { createExtensionService } from "~/server/extension/service";
import { RECORDING_IDLE_TIMEOUT_MS } from "~/server/extension/service/recordings";

const INSTALLATION_ONE = "11111111-1111-4111-8111-111111111111";
const INSTALLATION_TWO = "22222222-2222-4222-8222-222222222222";
const MINUTE = 60_000;

describe("extension recording sweeper", () => {
  let ctx: TestDbContext;
  let clock: Date;

  beforeAll(async () => {
    ctx = await createExtensionFixture("extension-recording-sweeper");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
    clock = new Date("2026-10-01T15:00:00.000Z");
  });

  function advance(ms: number) {
    clock = new Date(clock.getTime() + ms);
  }

  async function startRecording(
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
        operationAt(clock),
      ),
    );
    return { sessionToken, callId, recordingId };
  }

  async function upload(
    scenario: ReturnType<typeof createExtensionScenario>,
    open: { sessionToken: string; recordingId: string },
    seq: number,
  ) {
    expectOk(
      await scenario.service.putSegment(
        {
          sessionToken: open.sessionToken,
          recordingId: open.recordingId,
          seq,
          contentType: "audio/webm;codecs=opus",
          channels: EXTENSION_SEGMENT_CHANNEL_LAYOUT,
          startedAt: clock.getTime(),
          readBody: () => Promise.resolve(new Uint8Array(8).fill(seq + 1)),
        },
        operationAt(clock),
      ),
    );
  }

  function closeWith(
    scenario: ReturnType<typeof createExtensionScenario>,
    open: { sessionToken: string; recordingId: string },
    manifest: { segments: number; bytes: number; interrupted: boolean },
  ) {
    return scenario.service.closeRecording(
      {
        sessionToken: open.sessionToken,
        recordingId: open.recordingId,
        ...manifest,
      },
      operationAt(clock),
    );
  }

  async function recordingState() {
    return ctx.db
      .selectFrom("extension_recordings")
      .innerJoin(
        "extension_calls",
        "extension_calls.id",
        "extension_recordings.call_id",
      )
      .select([
        "extension_recordings.status",
        "extension_recordings.closed_at",
        "extension_calls.ended_at",
      ])
      .execute();
  }

  it("leaves a recording alone until it has been idle for the full timeout", async () => {
    const scenario = createExtensionScenario(ctx, () => clock);
    const open = await startRecording(scenario);
    await upload(scenario, open, 0);

    advance(RECORDING_IDLE_TIMEOUT_MS - 1);
    const swept = await scenario.service.sweepIdleRecordings(
      operationAt(clock),
    );

    expect(swept).toEqual({ interruptedRecordings: 0, endedCalls: 0 });
    const [state] = await recordingState();
    expect(state?.status).toBe("open");
    expect(state?.closed_at).toBeNull();
    expect(state?.ended_at).toBeNull();
  });

  it("marks an idle recording interrupted, keeps its segments and ends the call", async () => {
    const scenario = createExtensionScenario(ctx, () => clock);
    const open = await startRecording(scenario);
    await upload(scenario, open, 0);
    await upload(scenario, open, 1);

    advance(RECORDING_IDLE_TIMEOUT_MS);
    const swept = await scenario.service.sweepIdleRecordings(
      operationAt(clock),
    );

    expect(swept).toEqual({ interruptedRecordings: 1, endedCalls: 0 });
    const [state] = await recordingState();
    expect(state?.status).toBe("interrupted");
    expect(state?.closed_at?.getTime()).toBe(clock.getTime());
    expect(state?.ended_at?.getTime()).toBe(clock.getTime());
    const segments = await ctx.db
      .selectFrom("extension_recording_segments")
      .select(["seq", "storage_key"])
      .orderBy("seq")
      .execute();
    expect(segments.map((segment) => segment.seq)).toEqual([0, 1]);
    for (const segment of segments) {
      expect(
        (await scenario.storage.getBytes(segment.storage_key)).length,
      ).toBe(8);
    }
  });

  it("counts every stored segment as activity, so a live recording is not swept", async () => {
    const scenario = createExtensionScenario(ctx, () => clock);
    const open = await startRecording(scenario);
    await upload(scenario, open, 0);

    advance(9 * MINUTE);
    await upload(scenario, open, 1);
    advance(9 * MINUTE);
    const swept = await scenario.service.sweepIdleRecordings(
      operationAt(clock),
    );

    expect(swept.interruptedRecordings).toBe(0);
  });

  it("never overwrites a complete recording", async () => {
    const scenario = createExtensionScenario(ctx, () => clock);
    const open = await startRecording(scenario);
    await upload(scenario, open, 0);
    const closed = expectOk(
      await closeWith(scenario, open, {
        segments: 1,
        bytes: 8,
        interrupted: false,
      }),
    ) satisfies CloseRecordingResponse;
    expect(closed.status).toBe("complete");
    const [before] = await recordingState();

    advance(RECORDING_IDLE_TIMEOUT_MS * 3);
    const swept = await scenario.service.sweepIdleRecordings(
      operationAt(clock),
    );

    expect(swept.interruptedRecordings).toBe(0);
    const [after] = await recordingState();
    expect(after).toEqual({ ...before, status: "complete" });
  });

  it("sweeps only the idle recording when another is still active", async () => {
    const scenario = createExtensionScenario(ctx, () => clock);
    const idle = await startRecording(scenario, INSTALLATION_ONE, "execOne");
    const active = await startRecording(scenario, INSTALLATION_TWO, "execTwo");
    await upload(scenario, idle, 0);
    await upload(scenario, active, 0);

    advance(8 * MINUTE);
    await upload(scenario, active, 1);
    advance(3 * MINUTE);
    const swept = await scenario.service.sweepIdleRecordings(
      operationAt(clock),
    );

    expect(swept.interruptedRecordings).toBe(1);
    const rows = await ctx.db
      .selectFrom("extension_recordings")
      .select(["id", "status"])
      .execute();
    const byId = new Map(rows.map((row) => [row.id, row.status]));
    expect(byId.get(ExtensionRecordingId.trust(idle.recordingId))).toBe(
      "interrupted",
    );
    expect(byId.get(ExtensionRecordingId.trust(active.recordingId))).toBe(
      "open",
    );
  });

  it("lets a complete close overwrite interrupted once the missing segments arrive", async () => {
    const scenario = createExtensionScenario(ctx, () => clock);
    const open = await startRecording(scenario);
    await upload(scenario, open, 1);
    advance(RECORDING_IDLE_TIMEOUT_MS);
    await scenario.service.sweepIdleRecordings(operationAt(clock));
    expect((await recordingState())[0]?.status).toBe("interrupted");

    await upload(scenario, open, 0);
    advance(MINUTE);
    const closed = expectOk(
      await closeWith(scenario, open, {
        segments: 2,
        bytes: 16,
        interrupted: true,
      }),
    );

    expect(closed).toEqual({ status: "complete", segments: 2, bytes: 16 });
    const [state] = await recordingState();
    expect(state?.status).toBe("complete");
    expect(state?.closed_at?.getTime()).toBe(clock.getTime());
  });

  it("does not sweep an interrupted recording a second time", async () => {
    const scenario = createExtensionScenario(ctx, () => clock);
    const open = await startRecording(scenario);
    await upload(scenario, open, 0);
    advance(RECORDING_IDLE_TIMEOUT_MS);

    const first = await scenario.service.sweepIdleRecordings(
      operationAt(clock),
    );
    advance(MINUTE);
    const second = await scenario.service.sweepIdleRecordings(
      operationAt(clock),
    );

    expect([first.interruptedRecordings, second.interruptedRecordings]).toEqual(
      [1, 0],
    );
  });

  it("ends a claimed call that never got a recording, measured from the claim", async () => {
    const scenario = createExtensionScenario(ctx, () => clock);
    await scenario.claim(INSTALLATION_ONE);

    advance(RECORDING_IDLE_TIMEOUT_MS - 1);
    const early = await scenario.service.sweepIdleRecordings(
      operationAt(clock),
    );
    advance(1);
    const due = await scenario.service.sweepIdleRecordings(operationAt(clock));

    expect(early.endedCalls).toBe(0);
    expect(due).toEqual({ interruptedRecordings: 0, endedCalls: 1 });
    const call = await ctx.db
      .selectFrom("extension_calls")
      .select("ended_at")
      .executeTakeFirstOrThrow();
    expect(call.ended_at?.getTime()).toBe(clock.getTime());
  });

  it("leaves a call that has a recording to the recording's own lifecycle", async () => {
    const scenario = createExtensionScenario(ctx, () => clock);
    const { sessionToken, callId } = await scenario.claim(INSTALLATION_ONE);
    advance(6 * MINUTE);
    const { recordingId } = expectOk(
      await scenario.service.createRecording(
        { sessionToken, callId },
        operationAt(clock),
      ),
    );
    await upload(scenario, { sessionToken, recordingId }, 0);

    advance(5 * MINUTE);
    const swept = await scenario.service.sweepIdleRecordings(
      operationAt(clock),
    );

    expect(swept).toEqual({ interruptedRecordings: 0, endedCalls: 0 });
    const call = await ctx.db
      .selectFrom("extension_calls")
      .select("ended_at")
      .executeTakeFirstOrThrow();
    expect(call.ended_at).toBeNull();
  });

  it("fails loudly when the sweep's unit of work fails, instead of reporting nothing swept", async () => {
    const service = createExtensionService(ctx.repos, {
      uow: rejectingUow(new Error("database unavailable")),
      storage: createExtensionScenario(ctx).storage,
    });

    await expect(
      service.sweepIdleRecordings(operationAt(clock)),
    ).rejects.toThrow(/database unavailable/);
  });
});

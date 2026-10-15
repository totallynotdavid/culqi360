import { readdir } from "node:fs/promises";

import {
  EXTENSION_SEGMENT_CHANNEL_LAYOUT,
  EXTENSION_SEGMENT_MAX_BYTES,
} from "@crm/contracts/extension";
import { expectErr, expectOk } from "@tests/support/_core/assertions";
import {
  commitThenRejectUow,
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
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createExtensionService } from "~/server/extension/service";
import { RECORDING_IDLE_TIMEOUT_MS } from "~/server/extension/service/recordings";
import type { ExtensionRepos } from "~/server/extension/service/shared";
import type { AppUow } from "~/server/platform/database/uow";

const INSTALLATION_ONE = "11111111-1111-4111-8111-111111111111";
const INSTALLATION_TWO = "22222222-2222-4222-8222-222222222222";
const STARTED_AT = Date.UTC(2026, 9, 1, 15, 0, 0);

function audio(...bytes: number[]): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

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

function segment(
  open: { sessionToken: string; recordingId: string },
  seq: number,
  body: Uint8Array<ArrayBuffer>,
  overrides: Partial<{
    contentType: string;
    channels: string;
    startedAt: number;
  }> = {},
) {
  return {
    sessionToken: open.sessionToken,
    recordingId: open.recordingId,
    seq,
    contentType: overrides.contentType ?? "audio/webm;codecs=opus",
    channels: overrides.channels ?? EXTENSION_SEGMENT_CHANNEL_LAYOUT,
    startedAt: overrides.startedAt ?? STARTED_AT + seq * 1000,
    readBody: () => Promise.resolve(body),
  };
}

describe("extension recording segment upload", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createExtensionFixture("extension-recording-segments");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  it("stores the segment bytes in the project upload store and reports the stored size", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);

    const stored = expectOk(
      await scenario.service.putSegment(
        segment(open, 0, audio(1, 2, 3, 4)),
        operationAt(new Date()),
      ),
    );

    expect(stored).toEqual({ seq: 0, sizeBytes: 4 });
    const row = await ctx.db
      .selectFrom("extension_recording_segments")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row.content_type).toBe("audio/webm;codecs=opus");
    expect(row.channels).toBe("mic-left,tab-right");
    expect(row.started_at.getTime()).toBe(STARTED_AT);
    expect(
      Array.from(await scenario.storage.getBytes(row.storage_key)),
    ).toEqual([1, 2, 3, 4]);
  });

  it("accepts the same bytes again for a stored seq without storing a second copy", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    expectOk(
      await scenario.service.putSegment(
        segment(open, 3, audio(9, 9, 9)),
        operationAt(new Date()),
      ),
    );

    const again = expectOk(
      await scenario.service.putSegment(
        segment(open, 3, audio(9, 9, 9)),
        operationAt(new Date()),
      ),
    );

    expect(again).toEqual({ seq: 3, sizeBytes: 3 });
    const rows = await ctx.db
      .selectFrom("extension_recording_segments")
      .select("seq")
      .execute();
    expect(rows).toHaveLength(1);
  });

  it("answers conflict for different bytes on a stored seq and keeps the first bytes", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    expectOk(
      await scenario.service.putSegment(
        segment(open, 1, audio(1, 1, 1)),
        operationAt(new Date()),
      ),
    );

    const error = expectErr(
      await scenario.service.putSegment(
        segment(open, 1, audio(2, 2, 2, 2)),
        operationAt(new Date()),
      ),
    );

    expect(error.code).toBe("segment_conflict");
    const row = await ctx.db
      .selectFrom("extension_recording_segments")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row.size_bytes).toBe(3);
    expect(
      Array.from(await scenario.storage.getBytes(row.storage_key)),
    ).toEqual([1, 1, 1]);
  });

  it("lets exactly one of two racing uploads with different bytes win", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);

    const results = await Promise.all([
      scenario.service.putSegment(
        segment(open, 5, audio(1, 1)),
        operationAt(new Date()),
      ),
      scenario.service.putSegment(
        segment(open, 5, audio(2, 2, 2)),
        operationAt(new Date()),
      ),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const rows = await ctx.db
      .selectFrom("extension_recording_segments")
      .selectAll()
      .execute();
    expect(rows).toHaveLength(1);
    const [row] = rows;
    const stored = await scenario.storage.getBytes(row?.storage_key ?? "");
    expect(stored.byteLength).toBe(row?.size_bytes);
  });

  it("accepts segments out of order", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);

    for (const seq of [2, 0, 1]) {
      expectOk(
        await scenario.service.putSegment(
          segment(open, seq, audio(seq)),
          operationAt(new Date()),
        ),
      );
    }

    const rows = await ctx.db
      .selectFrom("extension_recording_segments")
      .select("seq")
      .orderBy("seq")
      .execute();
    expect(rows.map((row) => row.seq)).toEqual([0, 1, 2]);
  });

  it("refreshes the recording activity time on every stored segment", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    const later = new Date(Date.now() + 5 * 60_000);

    expectOk(
      await scenario.service.putSegment(
        segment(open, 0, audio(1)),
        operationAt(later),
      ),
    );

    const recording = await ctx.db
      .selectFrom("extension_recordings")
      .select("last_activity_at")
      .executeTakeFirstOrThrow();
    expect(recording.last_activity_at.getTime()).toBe(later.getTime());
  });

  it("rejects a segment the declared contract does not allow", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    const upload = (input: ReturnType<typeof segment>) =>
      scenario.service.putSegment(input, operationAt(new Date()));

    const codes = [
      await upload(segment(open, 0, audio(1), { contentType: "text/plain" })),
      await upload(segment(open, 0, audio(1), { channels: "mono" })),
      await upload(segment(open, 0, audio(1), { startedAt: Number.NaN })),
      await upload(segment(open, -1, audio(1))),
      await upload(segment(open, 0, new Uint8Array(0))),
      await upload(
        segment(open, 0, new Uint8Array(EXTENSION_SEGMENT_MAX_BYTES + 1)),
      ),
    ].map((result) => expectErr(result).code);

    expect(codes).toEqual([
      "invalid_segment_content_type",
      "invalid_segment_channels",
      "invalid_segment_started_at",
      "invalid_segment_seq",
      "segment_empty",
      "segment_too_large",
    ]);
    const rows = await ctx.db
      .selectFrom("extension_recording_segments")
      .select("seq")
      .execute();
    expect(rows).toHaveLength(0);
  });

  it("hides a recording from another installation session", async () => {
    const scenario = createExtensionScenario(ctx);
    const owner = await openRecording(scenario, INSTALLATION_ONE, "execOne");
    const other = await openRecording(scenario, INSTALLATION_TWO, "execTwo");

    const error = expectErr(
      await scenario.service.putSegment(
        segment(
          { sessionToken: other.sessionToken, recordingId: owner.recordingId },
          0,
          audio(1),
        ),
        operationAt(new Date()),
      ),
    );

    expect(error.code).toBe("recording_not_found");
  });

  it("rejects a recording id the server never minted", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);

    const unknown = expectErr(
      await scenario.service.putSegment(
        segment(
          { sessionToken: open.sessionToken, recordingId: crypto.randomUUID() },
          0,
          audio(1),
        ),
        operationAt(new Date()),
      ),
    );
    const malformed = expectErr(
      await scenario.service.putSegment(
        segment(
          { sessionToken: open.sessionToken, recordingId: "rec-1" },
          0,
          audio(1),
        ),
        operationAt(new Date()),
      ),
    );

    expect(unknown.code).toBe("recording_not_found");
    expect(malformed.code).toBe("invalid_extension_recording_id");
  });

  async function storedBlobs(recordingId: string): Promise<string[]> {
    const entries = await readdir(ctx.storageRoot, { recursive: true });
    return entries.filter(
      (entry) => entry.includes(recordingId) && /-[0-9a-f]{64}$/.test(entry),
    );
  }

  function serviceWithUow(
    scenario: ReturnType<typeof createExtensionScenario>,
    uow: AppUow<ExtensionRepos>,
  ) {
    return createExtensionService(ctx.repos, {
      uow,
      storage: scenario.storage,
    });
  }

  it("accepts segments while the recording is interrupted", async () => {
    const clock = new Date();
    const scenario = createExtensionScenario(ctx, () => clock);
    const open = await openRecording(scenario);
    const later = new Date(
      clock.getTime() + RECORDING_IDLE_TIMEOUT_MS + 60_000,
    );
    await scenario.service.sweepIdleRecordings(operationAt(later));

    const stored = expectOk(
      await scenario.service.putSegment(
        segment(open, 0, audio(5, 5)),
        operationAt(later),
      ),
    );

    expect(stored).toEqual({ seq: 0, sizeBytes: 2 });
    const recording = await ctx.db
      .selectFrom("extension_recordings")
      .select("status")
      .executeTakeFirstOrThrow();
    expect(recording.status).toBe("interrupted");
  });

  it("rejects a segment once the recording is complete, even a new seq", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    expectOk(
      await scenario.service.putSegment(
        segment(open, 0, audio(1, 1)),
        operationAt(new Date()),
      ),
    );
    expectOk(
      await scenario.service.closeRecording(
        {
          sessionToken: open.sessionToken,
          recordingId: open.recordingId,
          segments: 1,
          bytes: 2,
          interrupted: false,
        },
        operationAt(new Date()),
      ),
    );

    const late = expectErr(
      await scenario.service.putSegment(
        segment(open, 1, audio(2, 2)),
        operationAt(new Date()),
      ),
    );

    expect(late.code).toBe("recording_closed");
    const rows = await ctx.db
      .selectFrom("extension_recording_segments")
      .select("seq")
      .execute();
    expect(rows.map((row) => row.seq)).toEqual([0]);
    expect(await storedBlobs(open.recordingId)).toHaveLength(1);
  });

  it("does not count a conflicting upload as activity", async () => {
    const clock = new Date();
    const scenario = createExtensionScenario(ctx, () => clock);
    const open = await openRecording(scenario);
    expectOk(
      await scenario.service.putSegment(
        segment(open, 0, audio(1, 1)),
        operationAt(clock),
      ),
    );

    const later = new Date(clock.getTime() + 5 * 60_000);
    const conflict = expectErr(
      await scenario.service.putSegment(
        segment(open, 0, audio(2, 2)),
        operationAt(later),
      ),
    );

    expect(conflict.code).toBe("segment_conflict");
    const recording = await ctx.db
      .selectFrom("extension_recordings")
      .select("last_activity_at")
      .executeTakeFirstOrThrow();
    expect(recording.last_activity_at.getTime()).toBe(clock.getTime());
  });

  it("removes the stored blob when the segment's unit of work fails", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    const failing = serviceWithUow(
      scenario,
      rejectingUow(new Error("connection lost")),
    );

    const error = expectErr(
      await failing.putSegment(
        segment(open, 0, audio(1, 2, 3)),
        operationAt(new Date()),
      ),
    );

    expect(error.code).toBe("unexpected");
    expect(await storedBlobs(open.recordingId)).toEqual([]);
  });

  it("keeps a blob that a committed row references when the acknowledgement is lost", async () => {
    const scenario = createExtensionScenario(ctx);
    const open = await openRecording(scenario);
    const commitThenFail = serviceWithUow(
      scenario,
      commitThenRejectUow(ctx, new Error("connection lost after commit")),
    );

    expectErr(
      await commitThenFail.putSegment(
        segment(open, 0, audio(4, 4)),
        operationAt(new Date()),
      ),
    );

    const row = await ctx.db
      .selectFrom("extension_recording_segments")
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(
      Array.from(await scenario.storage.getBytes(row.storage_key)),
    ).toEqual([4, 4]);
    const retry = expectOk(
      await scenario.service.putSegment(
        segment(open, 0, audio(4, 4)),
        operationAt(new Date()),
      ),
    );
    expect(retry).toEqual({ seq: 0, sizeBytes: 2 });
  });

  it("does not read the body of a request it will refuse", async () => {
    const scenario = createExtensionScenario(ctx);
    const owner = await openRecording(scenario, INSTALLATION_ONE, "execOne");
    const other = await openRecording(scenario, INSTALLATION_TWO, "execTwo");
    const readBody = vi.fn<() => Promise<Uint8Array<ArrayBuffer>>>(() =>
      Promise.resolve(audio(1)),
    );
    const put = (token: string, recordingId: string) =>
      scenario.service.putSegment(
        {
          ...segment({ sessionToken: token, recordingId }, 0, audio(1)),
          readBody,
        },
        operationAt(new Date()),
      );

    const refused = [
      await put("not-a-jwt", owner.recordingId),
      await put(other.sessionToken, owner.recordingId),
      await put(owner.sessionToken, crypto.randomUUID()),
    ];
    expectOk(
      await scenario.service.closeRecording(
        {
          sessionToken: owner.sessionToken,
          recordingId: owner.recordingId,
          segments: 0,
          bytes: 0,
          interrupted: false,
        },
        operationAt(new Date()),
      ),
    );
    refused.push(await put(owner.sessionToken, owner.recordingId));
    const codes = refused.map((result) => expectErr(result).code);

    expect(codes).toEqual([
      "extension_session_invalid",
      "recording_not_found",
      "recording_not_found",
      "recording_closed",
    ]);
    expect(readBody).not.toHaveBeenCalled();
  });
});

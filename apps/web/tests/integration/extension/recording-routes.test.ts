import {
  EXTENSION_RECORDINGS_PATH,
  EXTENSION_SEGMENT_CHANNELS_HEADER,
  EXTENSION_SEGMENT_CHANNEL_LAYOUT,
  EXTENSION_SEGMENT_MAX_BYTES,
  EXTENSION_SEGMENT_STARTED_AT_HEADER,
  isClaimExtensionSessionResponse,
  isCloseRecordingResponse,
  isCreateRecordingResponse,
  isUploadSegmentResponse,
  recordingClosePath,
  recordingSegmentPath,
} from "@crm/contracts/extension";
import { createExtensionScenario } from "@tests/support/extension/api";
import { createExtensionFixture } from "@tests/support/extension/fixture";
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

// Only the composition root and the per-request clock are replaced. The
// routes, the extension service, the database and the file store are real.
const harness = vi.hoisted(() => ({
  extension: null as unknown,
  now: new Date(),
}));

vi.mock("~/server/composition/application", () => ({
  getApplication: () => ({ extension: harness.extension }),
}));
vi.mock("~/server/platform/http/request-context-storage", () => ({
  getRequestOperation: () => ({ operationAt: harness.now }),
}));

import { POST as postRecording } from "~/routes/api/extension/recordings";
import { POST as postClose } from "~/routes/api/extension/recordings/[recordingId]/close";
import { PUT as putSegment } from "~/routes/api/extension/recordings/[recordingId]/segments/[seq]";
import { POST as postClaim } from "~/routes/api/extension/session/claim";
import { RECORDING_IDLE_TIMEOUT_MS } from "~/server/extension/service/recordings";

const INSTALLATION_ONE = "11111111-1111-4111-8111-111111111111";
const INSTALLATION_TWO = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "http://localhost";
const CODEC = "audio/webm;codecs=opus";
const T0 = new Date("2026-10-01T15:00:00.000Z");

function advance(ms: number) {
  harness.now = new Date(harness.now.getTime() + ms);
}

async function json(response: Response): Promise<unknown> {
  return (await response.json()) as unknown;
}

function createRecording(sessionToken: string | null, callId: string) {
  return postRecording({
    request: new Request(`${ORIGIN}${EXTENSION_RECORDINGS_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({ callId }),
    }),
  });
}

/** A segment request whose body stream records whether anything pulled it. */
function streamedUpload(
  sessionToken: string,
  recordingId: string,
  headers: Record<string, string> = {},
) {
  let pulled = false;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulled = true;
        controller.enqueue(Uint8Array.of(1));
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  const request = new Request(
    `${ORIGIN}${recordingSegmentPath(recordingId, 0)}`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": CODEC,
        [EXTENSION_SEGMENT_CHANNELS_HEADER]: EXTENSION_SEGMENT_CHANNEL_LAYOUT,
        [EXTENSION_SEGMENT_STARTED_AT_HEADER]: String(T0.getTime()),
        ...headers,
      },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" },
  );
  return {
    send: () => putSegment({ request, params: { recordingId, seq: "0" } }),
    wasRead: () => pulled,
  };
}

function upload(
  sessionToken: string,
  recordingId: string,
  seq: number,
  body: Uint8Array<ArrayBuffer>,
  headers: Record<string, string> = {},
) {
  return putSegment({
    request: new Request(`${ORIGIN}${recordingSegmentPath(recordingId, seq)}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": CODEC,
        [EXTENSION_SEGMENT_CHANNELS_HEADER]: EXTENSION_SEGMENT_CHANNEL_LAYOUT,
        [EXTENSION_SEGMENT_STARTED_AT_HEADER]: String(
          T0.getTime() + seq * 1000,
        ),
        ...headers,
      },
      body,
    }),
    params: { recordingId, seq: String(seq) },
  });
}

function close(
  sessionToken: string,
  recordingId: string,
  manifest: { segments: number; bytes: number; interrupted: boolean },
) {
  return postClose({
    request: new Request(`${ORIGIN}${recordingClosePath(recordingId)}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(manifest),
    }),
    params: { recordingId },
  });
}

describe("extension recording routes", () => {
  let ctx: TestDbContext;
  let scenario: ReturnType<typeof createExtensionScenario>;

  beforeAll(async () => {
    ctx = await createExtensionFixture("extension-recording-routes");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
    harness.now = T0;
    scenario = createExtensionScenario(ctx, () => harness.now);
    harness.extension = scenario.service;
  });

  async function claim(
    installationId = INSTALLATION_ONE,
    executive: "execOne" | "execTwo" = "execOne",
  ) {
    const { handoffToken } = await scenario.handoff(executive);
    const response = await postClaim({
      request: new Request(`${ORIGIN}/api/extension/session/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handoffToken, installationId }),
      }),
    });
    expect(response.status).toBe(200);
    const body = await json(response);
    if (!isClaimExtensionSessionResponse(body)) {
      throw new Error(
        `claim response broke the contract: ${JSON.stringify(body)}`,
      );
    }
    return body;
  }

  async function startRecording(
    installationId = INSTALLATION_ONE,
    executive: "execOne" | "execTwo" = "execOne",
  ) {
    const session = await claim(installationId, executive);
    const response = await createRecording(
      session.sessionToken,
      session.callId,
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    if (!isCreateRecordingResponse(body)) {
      throw new Error("create recording response broke the contract");
    }
    return { ...session, recordingId: body.recordingId };
  }

  it("takes a recording from claim to complete across out-of-order, repeated and missing segments", async () => {
    const claimed = await claim();
    expect(Object.keys(claimed).toSorted()).toEqual([
      "callId",
      "expiresAt",
      "refreshToken",
      "sessionToken",
    ]);

    const created = await createRecording(claimed.sessionToken, claimed.callId);
    expect(created.status).toBe(200);
    const createdBody = await json(created);
    if (!isCreateRecordingResponse(createdBody)) {
      throw new Error("create recording response broke the contract");
    }
    const { recordingId } = createdBody;
    const again = await createRecording(claimed.sessionToken, claimed.callId);
    expect(await json(again)).toEqual({ recordingId });

    const first = await upload(
      claimed.sessionToken,
      recordingId,
      2,
      Uint8Array.of(2, 2, 2, 2),
    );
    expect(first.status).toBe(200);
    expect(await json(first)).toEqual({ seq: 2, sizeBytes: 4 });
    const opening = await upload(
      claimed.sessionToken,
      recordingId,
      0,
      Uint8Array.of(0, 0),
    );
    expect(isUploadSegmentResponse(await json(opening))).toBe(true);

    const repeat = await upload(
      claimed.sessionToken,
      recordingId,
      0,
      Uint8Array.of(0, 0),
    );
    expect(repeat.status).toBe(200);
    expect(await json(repeat)).toEqual({ seq: 0, sizeBytes: 2 });

    const conflicting = await upload(
      claimed.sessionToken,
      recordingId,
      0,
      Uint8Array.of(9, 9, 9),
    );
    expect(conflicting.status).toBe(409);

    const early = await close(claimed.sessionToken, recordingId, {
      segments: 3,
      bytes: 9,
      interrupted: false,
    });
    expect(early.status).toBe(200);
    const earlyBody = await json(early);
    expect(isCloseRecordingResponse(earlyBody)).toBe(true);
    expect(earlyBody).toEqual({ status: "missing", missing: [1] });

    const late = await upload(
      claimed.sessionToken,
      recordingId,
      1,
      Uint8Array.of(1, 1, 1),
    );
    expect(late.status).toBe(200);

    const done = await close(claimed.sessionToken, recordingId, {
      segments: 3,
      bytes: 9,
      interrupted: false,
    });
    expect(done.status).toBe(200);
    expect(await json(done)).toEqual({
      status: "complete",
      segments: 3,
      bytes: 9,
    });

    const stored = await ctx.db
      .selectFrom("extension_recording_segments")
      .select(["seq", "storage_key"])
      .orderBy("seq")
      .execute();
    expect(stored.map((segment) => segment.seq)).toEqual([0, 1, 2]);
    expect(
      Array.from(await scenario.storage.getBytes(stored[2]?.storage_key ?? "")),
    ).toEqual([2, 2, 2, 2]);
    const call = await ctx.db
      .selectFrom("extension_calls")
      .select("ended_at")
      .executeTakeFirstOrThrow();
    expect(call.ended_at).not.toBeNull();
  });

  it("answers 401 without a bearer token and 404 for another installation's ids", async () => {
    const owner = await startRecording(INSTALLATION_ONE, "execOne");
    const other = await claim(INSTALLATION_TWO, "execTwo");

    const anonymous = await createRecording(null, owner.callId);
    const foreignCall = await createRecording(other.sessionToken, owner.callId);
    const foreignSegment = await upload(
      other.sessionToken,
      owner.recordingId,
      0,
      Uint8Array.of(1),
    );
    const foreignClose = await close(other.sessionToken, owner.recordingId, {
      segments: 0,
      bytes: 0,
      interrupted: false,
    });
    const invalidToken = await upload(
      "not-a-jwt",
      owner.recordingId,
      0,
      Uint8Array.of(1),
    );

    expect(anonymous.status).toBe(401);
    expect(foreignCall.status).toBe(404);
    expect(foreignSegment.status).toBe(404);
    expect(foreignClose.status).toBe(404);
    expect(invalidToken.status).toBe(401);
  });

  it("rejects segments that break the upload contract", async () => {
    const recording = await startRecording();
    const send = (
      body: Uint8Array<ArrayBuffer>,
      headers: Record<string, string> = {},
      seq = 0,
    ) =>
      upload(recording.sessionToken, recording.recordingId, seq, body, headers);

    const wrongCodec = await send(Uint8Array.of(1), {
      "content-type": "application/json",
    });
    const wrongChannels = await send(Uint8Array.of(1), {
      [EXTENSION_SEGMENT_CHANNELS_HEADER]: "mono",
    });
    const noStart = await send(Uint8Array.of(1), {
      [EXTENSION_SEGMENT_STARTED_AT_HEADER]: "later",
    });
    const empty = await send(new Uint8Array(0));
    const tooLarge = await send(
      new Uint8Array(EXTENSION_SEGMENT_MAX_BYTES + 1),
    );
    const badSeq = await upload(
      recording.sessionToken,
      recording.recordingId,
      -1,
      Uint8Array.of(1),
    );

    expect([
      wrongCodec.status,
      wrongChannels.status,
      noStart.status,
      empty.status,
      tooLarge.status,
      badSeq.status,
    ]).toEqual([400, 400, 400, 400, 413, 400]);
  });

  it("answers 401 for a bad token without reading the body", async () => {
    const recording = await startRecording();
    const streamed = streamedUpload("not-a-jwt", recording.recordingId);

    const response = await streamed.send();

    expect(response.status).toBe(401);
    expect(streamed.wasRead()).toBe(false);
  });

  it("answers 413 from Content-Length before authenticating or reading the body", async () => {
    const recording = await startRecording();
    const oversize = {
      "content-length": String(EXTENSION_SEGMENT_MAX_BYTES + 1),
    };
    const authenticated = streamedUpload(
      recording.sessionToken,
      recording.recordingId,
      oversize,
    );
    const unauthenticated = streamedUpload(
      "not-a-jwt",
      recording.recordingId,
      oversize,
    );

    const response = await authenticated.send();
    const unauthenticatedResponse = await unauthenticated.send();

    expect([response.status, unauthenticatedResponse.status]).toEqual([
      413, 413,
    ]);
    expect([authenticated.wasRead(), unauthenticated.wasRead()]).toEqual([
      false,
      false,
    ]);
  });

  it("rejects a manifest the contract does not allow with 400", async () => {
    const recording = await startRecording();

    const response = await postClose({
      request: new Request(
        `${ORIGIN}${recordingClosePath(recording.recordingId)}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${recording.sessionToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ segments: "3", bytes: 9 }),
        },
      ),
      params: { recordingId: recording.recordingId },
    });

    expect(response.status).toBe(400);
  });

  it("finalizes an abandoned recording through the sweeper and still lets the extension finish it", async () => {
    const recording = await startRecording();
    await upload(
      recording.sessionToken,
      recording.recordingId,
      0,
      Uint8Array.of(7, 7),
    );

    advance(RECORDING_IDLE_TIMEOUT_MS);
    const swept = await scenario.service.sweepIdleRecordings({
      operationAt: harness.now,
    });

    expect(swept.interruptedRecordings).toBe(1);
    const [state] = await ctx.db
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
    expect(state?.status).toBe("interrupted");
    expect(state?.closed_at?.getTime()).toBe(harness.now.getTime());
    expect(state?.ended_at?.getTime()).toBe(harness.now.getTime());

    const missing = await close(recording.sessionToken, recording.recordingId, {
      segments: 2,
      bytes: 4,
      interrupted: true,
    });
    expect(await json(missing)).toEqual({ status: "missing", missing: [1] });

    await upload(
      recording.sessionToken,
      recording.recordingId,
      1,
      Uint8Array.of(8, 8),
    );
    const done = await close(recording.sessionToken, recording.recordingId, {
      segments: 2,
      bytes: 4,
      interrupted: true,
    });
    expect(await json(done)).toEqual({
      status: "complete",
      segments: 2,
      bytes: 4,
    });
  });
});

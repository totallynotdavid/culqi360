import { createHash } from "node:crypto";

import {
  EXTENSION_SEGMENT_CHANNEL_LAYOUT,
  EXTENSION_SEGMENT_MAX_BYTES,
  EXTENSION_RECORDING_MAX_SEGMENTS,
  type CloseRecordingRequest,
  type CloseRecordingResponse,
  type CreateRecordingResponse,
  type UploadSegmentResponse,
} from "@crm/contracts/extension";

import { external, fail, invalid, type DomainError } from "~/domain/errors";
import { ExtensionCallId, ExtensionRecordingId } from "~/domain/ids";
import { addMilliseconds } from "~/domain/time/clock";
import type { AppUow } from "~/server/platform/database/uow";
import type { BlobStore } from "~/server/platform/files/blob-store";
import type { OperationContext } from "~/server/platform/operation/context";
import { Err, Ok, isErr, type Result } from "~/shared/result";

import type { ExtensionRecordingsRepo } from "../recordings-repo";
import { authenticateInstallationSession } from "./authenticate";
import type { ExtensionRepos } from "./shared";

interface RecordingsContext extends OperationContext {
  repos: ExtensionRepos;
}

interface RecordingsWriteContext extends RecordingsContext {
  uow: AppUow<ExtensionRepos>;
}

interface SegmentContext extends RecordingsWriteContext {
  storage: BlobStore;
}

type RecordingRow = NonNullable<
  Awaited<ReturnType<ExtensionRecordingsRepo["findRecordingForInstallation"]>>
>;

export interface SegmentUpload {
  sessionToken: string;
  recordingId: string;
  seq: number;
  contentType: string;
  channels: string;
  /** Epoch milliseconds. */
  startedAt: number;
  /**
   * Reads the request body. The service calls it at most once, and only after
   * the session, the recording and the recording's state are accepted, so a
   * request that will be refused never costs a body read.
   */
  readBody: () => Promise<Uint8Array<ArrayBuffer>>;
}

/** The manifest must already satisfy `isCloseRecordingRequest`. */
export interface CloseRecordingInput extends CloseRecordingRequest {
  sessionToken: string;
  recordingId: string;
}

export interface SweepOutcome {
  interruptedRecordings: number;
  endedCalls: number;
}

function unexpected(error: unknown): DomainError {
  return external(
    error instanceof Error
      ? error.message
      : "Unexpected extension recording failure",
    { code: "unexpected" },
  );
}

function validateSegmentHeaders(
  input: SegmentUpload,
): Result<{ startedAt: Date }, DomainError> {
  if (
    !Number.isSafeInteger(input.seq) ||
    input.seq < 0 ||
    input.seq >= EXTENSION_RECORDING_MAX_SEGMENTS
  ) {
    return Err(invalid({ code: "invalid_segment_seq" }));
  }
  if (!input.contentType.toLowerCase().startsWith("audio/")) {
    return Err(invalid({ code: "invalid_segment_content_type" }));
  }
  if (input.channels !== EXTENSION_SEGMENT_CHANNEL_LAYOUT) {
    return Err(invalid({ code: "invalid_segment_channels" }));
  }
  if (!Number.isSafeInteger(input.startedAt) || input.startedAt <= 0) {
    return Err(invalid({ code: "invalid_segment_started_at" }));
  }
  return Ok({ startedAt: new Date(input.startedAt) });
}

function validateSegmentBody(
  body: Uint8Array<ArrayBuffer>,
): Result<void, DomainError> {
  if (body.byteLength === 0) {
    return Err(invalid({ code: "segment_empty" }));
  }
  if (body.byteLength > EXTENSION_SEGMENT_MAX_BYTES) {
    return Err(invalid({ code: "segment_too_large" }));
  }
  return Ok(undefined);
}

/**
 * A recording belongs to the installation that claimed its call, not to the
 * session that did: a web login or a token refresh replaces the session, and
 * the audio the extension still holds must remain uploadable. Another user's
 * or installation's ids are reported as not found, so ids do not leak.
 */
async function findOwnedRecording(
  repos: ExtensionRepos,
  input: { sessionToken: string; recordingId: ExtensionRecordingId },
  at: Date,
): Promise<Result<RecordingRow, DomainError>> {
  const authenticated = await authenticateInstallationSession(
    repos,
    input.sessionToken,
    at,
  );
  if (isErr(authenticated)) {
    return authenticated;
  }

  const recording =
    await repos.extensionRecordings.findRecordingForInstallation(
      input.recordingId,
      {
        userId: authenticated.value.user_id,
        installationId: authenticated.value.installation_id,
      },
    );
  if (!recording) {
    return Err(fail("recording_not_found"));
  }
  return Ok(recording);
}

/**
 * One recording per call: a retry of the same call returns the recording the
 * first request made.
 */
export async function createRecording(
  context: RecordingsContext,
  input: { sessionToken: string; callId: string },
): Promise<Result<CreateRecordingResponse, DomainError>> {
  const { repos } = context;

  const callId = ExtensionCallId.parse(input.callId);
  if (isErr(callId)) {
    return Err(invalid({ code: "invalid_extension_call_id" }));
  }

  try {
    const authenticated = await authenticateInstallationSession(
      repos,
      input.sessionToken,
      context.operationAt,
    );
    if (isErr(authenticated)) {
      return authenticated;
    }

    const call = await repos.extensionRecordings.findCallForInstallation(
      callId.value,
      {
        userId: authenticated.value.user_id,
        installationId: authenticated.value.installation_id,
      },
    );
    if (!call) {
      return Err(fail("call_not_found"));
    }

    await repos.extensionRecordings.insertRecordingIfAbsent({
      call_id: call.id,
      created_at: context.operationAt,
    });
    const recording = await repos.extensionRecordings.findRecordingByCallId(
      call.id,
    );
    if (!recording) {
      throw new Error("extension recording missing after insert");
    }

    return Ok({ recordingId: recording.id });
  } catch (error: unknown) {
    return Err(unexpected(error));
  }
}

function segmentStorageKey(
  recordingId: string,
  seq: number,
  sha256Hex: string,
): string {
  return `extension-recordings/${recordingId}/${seq}-${sha256Hex}`;
}

function acknowledgeStoredSegment(
  stored: { seq: number; size_bytes: number; sha256_hex: string },
  sha256Hex: string,
): Result<UploadSegmentResponse, DomainError> {
  if (stored.sha256_hex !== sha256Hex) {
    return Err(fail("segment_conflict"));
  }
  return Ok({ seq: stored.seq, sizeBytes: stored.size_bytes });
}

/**
 * Deletes the blob unless a committed row points at it (a lost acknowledgement
 * or an identical concurrent upload). If the lookup or the delete fails the blob
 * stays. An unreferenced blob is harmless, a missing one is lost audio.
 */
async function discardUnreferencedBlob(
  context: SegmentContext,
  recording: RecordingRow,
  seq: number,
  storageKey: string,
): Promise<void> {
  try {
    const row = await context.repos.extensionRecordings.findSegment(
      recording.id,
      seq,
    );
    if (row?.storage_key === storageKey) {
      return;
    }
    await context.storage.delete(storageKey);
  } catch {
    // Swallowed on purpose, see the doc comment.
  }
}

async function insertSegment(
  context: SegmentContext,
  recording: RecordingRow,
  segment: {
    input: SegmentUpload;
    startedAt: Date;
    body: Uint8Array<ArrayBuffer>;
    sha256Hex: string;
    storageKey: string;
  },
): Promise<Result<boolean, DomainError>> {
  const { input } = segment;
  return context.uow.run(async (txRepos) => {
    const locked = await txRepos.extensionRecordings.lockRecording(
      recording.id,
    );
    if (locked?.status === "complete") {
      return Err(fail("recording_closed"));
    }

    const wasInserted = await txRepos.extensionRecordings.insertSegmentIfAbsent(
      {
        recording_id: recording.id,
        seq: input.seq,
        storage_key: segment.storageKey,
        content_type: input.contentType,
        channels: input.channels,
        started_at: segment.startedAt,
        size_bytes: segment.body.byteLength,
        sha256_hex: segment.sha256Hex,
        received_at: context.operationAt,
      },
    );
    if (wasInserted) {
      await txRepos.extensionRecordings.touchRecording(
        recording.id,
        context.operationAt,
      );
    }
    return Ok(wasInserted);
  });
}

async function storeSegment(
  context: SegmentContext,
  recording: RecordingRow,
  segment: {
    input: SegmentUpload;
    startedAt: Date;
    body: Uint8Array<ArrayBuffer>;
  },
): Promise<Result<UploadSegmentResponse, DomainError>> {
  const { repos, storage } = context;
  const { input, body } = segment;

  const sha256Hex = createHash("sha256").update(body).digest("hex");
  const existing = await repos.extensionRecordings.findSegment(
    recording.id,
    input.seq,
  );
  if (existing) {
    const acknowledged = acknowledgeStoredSegment(existing, sha256Hex);
    if (!isErr(acknowledged)) {
      await repos.extensionRecordings.touchRecording(
        recording.id,
        context.operationAt,
      );
    }
    return acknowledged;
  }

  const storageKey = segmentStorageKey(recording.id, input.seq, sha256Hex);
  await storage.putFromWebStream({
    key: storageKey,
    stream: new Blob([body]).stream(),
  });

  let inserted: Result<boolean, DomainError>;
  try {
    inserted = await insertSegment(context, recording, {
      ...segment,
      sha256Hex,
      storageKey,
    });
  } catch (error: unknown) {
    await discardUnreferencedBlob(context, recording, input.seq, storageKey);
    throw error;
  }
  if (isErr(inserted)) {
    await discardUnreferencedBlob(context, recording, input.seq, storageKey);
    return inserted;
  }
  if (inserted.value) {
    return Ok({ seq: input.seq, sizeBytes: body.byteLength });
  }

  const winner = await repos.extensionRecordings.findSegment(
    recording.id,
    input.seq,
  );
  if (!winner) {
    throw new Error("extension segment missing after conflicting insert");
  }
  const acknowledged = acknowledgeStoredSegment(winner, sha256Hex);
  if (isErr(acknowledged)) {
    await discardUnreferencedBlob(context, recording, input.seq, storageKey);
  }
  return acknowledged;
}

/**
 * Idempotent per (recording, seq): the same bytes again return the stored
 * size, different bytes for a stored seq are a conflict. The blob key carries
 * the content hash, so two racing uploads with different bytes never write the
 * same file. A recording takes segments while it is open or interrupted and
 * never after it is complete. See "Recordings" in docs/architecture.md.
 */
export async function putSegment(
  context: SegmentContext,
  input: SegmentUpload,
): Promise<Result<UploadSegmentResponse, DomainError>> {
  const recordingId = ExtensionRecordingId.parse(input.recordingId);
  if (isErr(recordingId)) {
    return Err(invalid({ code: "invalid_extension_recording_id" }));
  }

  const headers = validateSegmentHeaders(input);
  if (isErr(headers)) {
    return headers;
  }

  try {
    const recording = await findOwnedRecording(
      context.repos,
      { sessionToken: input.sessionToken, recordingId: recordingId.value },
      context.operationAt,
    );
    if (isErr(recording)) {
      return recording;
    }
    if (recording.value.status === "complete") {
      return Err(fail("recording_closed"));
    }

    const body = await input.readBody();
    const sized = validateSegmentBody(body);
    if (isErr(sized)) {
      return sized;
    }

    return await storeSegment(context, recording.value, {
      input,
      startedAt: headers.value.startedAt,
      body,
    });
  } catch (error: unknown) {
    return Err(unexpected(error));
  }
}

/**
 * Idle time after which the sweeper finalizes a recording (no segment, no
 * close) or ends a claimed call that never got one, measured from the claim.
 * Any stored or repeated segment is activity, so a backlog uploading after an
 * outage is never swept.
 */
export const RECORDING_IDLE_TIMEOUT_MS = 10 * 60_000;

/**
 * Moves idle `open` recordings to `interrupted` and ends their calls, and ends
 * calls that have no recording. It never touches an `interrupted` or
 * `complete` recording. Segments stay where they are, and the extension can
 * still upload the rest and close the recording. Throws when the unit of work
 * fails, so the scheduler logs the failure instead of seeing an empty sweep.
 */
export async function sweepIdleRecordings(
  context: Pick<RecordingsWriteContext, "uow" | "operationAt">,
): Promise<SweepOutcome> {
  const idleBefore = addMilliseconds(
    context.operationAt,
    -RECORDING_IDLE_TIMEOUT_MS,
  );

  const swept = await context.uow.run(async (txRepos) => {
    const interrupted =
      await txRepos.extensionRecordings.interruptIdleRecordings(
        idleBefore,
        context.operationAt,
      );
    await Promise.all(
      interrupted.map((recording) =>
        txRepos.extensionRecordings.endCall(
          recording.call_id,
          context.operationAt,
        ),
      ),
    );
    const endedCalls =
      await txRepos.extensionRecordings.endCallsWithoutRecording(
        idleBefore,
        context.operationAt,
      );
    return Ok({ interruptedRecordings: interrupted.length, endedCalls });
  });
  if (isErr(swept)) {
    throw new Error(`extension recording sweep failed: ${String(swept.error)}`);
  }
  return swept.value;
}

function missingSeqs(storedSeqs: number[], segments: number): number[] {
  const stored = new Set(storedSeqs);
  const missing: number[] = [];
  for (let seq = 0; seq < segments; seq += 1) {
    if (!stored.has(seq)) {
      missing.push(seq);
    }
  }
  return missing;
}

function repeatCompleteClose(
  recording: {
    expected_segments: number | null;
    expected_bytes: number | null;
  },
  manifest: CloseRecordingRequest,
): Result<CloseRecordingResponse, DomainError> {
  if (
    recording.expected_segments !== manifest.segments ||
    recording.expected_bytes !== manifest.bytes
  ) {
    return Err(fail("recording_manifest_mismatch"));
  }
  return Ok({
    status: "complete",
    segments: manifest.segments,
    bytes: manifest.bytes,
  });
}

/**
 * `complete` is the only answer that lets the extension delete its local
 * audio: segments 0..n-1 are stored and add up to the manifest's bytes. A close
 * that finds gaps changes nothing. Segments are read under the recording's row
 * lock, so none slips in between the check and the state change.
 */
export async function closeRecording(
  context: RecordingsWriteContext,
  input: CloseRecordingInput,
): Promise<Result<CloseRecordingResponse, DomainError>> {
  const { repos, uow } = context;

  const recordingId = ExtensionRecordingId.parse(input.recordingId);
  if (isErr(recordingId)) {
    return Err(invalid({ code: "invalid_extension_recording_id" }));
  }

  try {
    const owned = await findOwnedRecording(
      repos,
      { sessionToken: input.sessionToken, recordingId: recordingId.value },
      context.operationAt,
    );
    if (isErr(owned)) {
      return owned;
    }

    return await uow.run(async (txRepos) => {
      const recording = await txRepos.extensionRecordings.lockRecording(
        owned.value.id,
      );
      if (!recording) {
        return Err(fail("recording_not_found"));
      }
      if (recording.status === "complete") {
        return repeatCompleteClose(recording, input);
      }

      const stored = await txRepos.extensionRecordings.listSegmentSizesBelow(
        recording.id,
        input.segments,
      );
      const missing = missingSeqs(
        stored.map((segment) => segment.seq),
        input.segments,
      );
      if (missing.length > 0) {
        return Ok({
          status: "missing",
          missing,
        } satisfies CloseRecordingResponse);
      }

      const storedBytes = stored.reduce(
        (total, segment) => total + segment.size_bytes,
        0,
      );
      if (storedBytes !== input.bytes) {
        return Err(fail("recording_manifest_mismatch"));
      }

      await txRepos.extensionRecordings.completeRecording({
        recording_id: recording.id,
        closed_at: context.operationAt,
        reported_interrupted: input.interrupted,
        expected_segments: input.segments,
        expected_bytes: input.bytes,
      });
      await txRepos.extensionRecordings.endCall(
        recording.call_id,
        context.operationAt,
      );
      return Ok({
        status: "complete",
        segments: input.segments,
        bytes: storedBytes,
      } satisfies CloseRecordingResponse);
    });
  } catch (error: unknown) {
    return Err(unexpected(error));
  }
}

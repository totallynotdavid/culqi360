import {
  EXTENSION_RECORDINGS_PATH,
  recordingSegmentPath,
} from "@crm/contracts/extension";
import { expect, test } from "@playwright/test";

import {
  closeExtensionSession,
  launchExtensionSession,
} from "./support/extension-fixture";
import { createReceiver } from "./support/receiver";
import {
  beginCall,
  flush,
  rows,
  startRecording,
  stopRecording,
  waitForChunks,
} from "./support/scenario";

test.describe("segments upload one by one and the manifest decides", () => {
  test("puts every segment, then closes, then drops the local audio", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 3);
      await stopRecording(call);

      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("complete");

      const [recording] = [...receiver.recordings.values()];
      expect(receiver.recordings.size).toBe(1);
      expect(recording?.callId).toBe(call.callId);
      expect(recording?.status).toBe("complete");

      const manifest = receiver.closes.at(-1)?.manifest;
      expect(manifest).toMatchObject({ interrupted: false });
      expect(recording?.segments.size).toBe(manifest?.segments);
      expect(manifest?.segments).toBeGreaterThanOrEqual(3);
      for (const [seq, segment] of recording?.segments ?? []) {
        expect(segment.contentType).toMatch(/^audio\//);
        expect(segment.channels).toBe("mic-left,tab-right");
        expect(segment.startedAt).toBeGreaterThan(0);
        expect(segment.bytes.length).toBeGreaterThan(0);
        expect(seq).toBeLessThan(manifest?.segments ?? 0);
      }

      // The close goes out after the last segment of that pass.
      const calls = receiver.requests.map(
        (request) => `${request.method} ${request.path}`,
      );
      const firstClose = calls.findIndex((entry) => entry.endsWith("/close"));
      const lastPut = calls.findLastIndex((entry) => entry.startsWith("PUT "));
      expect(firstClose).toBeGreaterThan(lastPut);
      expect(
        calls.filter((entry) => entry === `POST ${EXTENSION_RECORDINGS_PATH}`),
      ).toHaveLength(1);

      await expect
        .poll(async () => (await rows(call.popup, "chunks")).length)
        .toBe(0);
      expect(await rows(call.popup, "recordings")).toMatchObject([
        { callId: call.callId, status: "complete" },
      ]);
      const pending = (await rows(call.popup, "queue")).filter(
        (row) =>
          typeof row.job === "object" &&
          row.job !== null &&
          String(Reflect.get(row.job, "kind")).startsWith("recording."),
      );
      expect(pending).toEqual([]);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("keeps the audio after a 2xx that stored nothing and re-sends what the close reports missing", async () => {
    const receiver = await createReceiver();
    receiver.acknowledgeWithoutStoring([1]);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 3);
      await stopRecording(call);

      await expect
        .poll(() => receiver.closes.at(-1)?.answer, { timeout: 30_000 })
        .toEqual({ status: "missing", missing: [1] });

      // The server answered 200 for segment 1, yet every chunk is still here.
      const kept = await rows(call.popup, "chunks");
      const total = kept.length;
      expect(total).toBeGreaterThanOrEqual(3);
      const sizes = new Map(kept.map((chunk) => [chunk.seq, chunk.bytes]));

      receiver.acknowledgeWithoutStoring([]);
      await flush(call);

      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("complete");
      const [recording] = [...receiver.recordings.values()];
      expect(recording?.segments.get(1)?.bytes.length).toBe(sizes.get(1));
      await expect
        .poll(async () => (await rows(call.popup, "chunks")).length)
        .toBe(0);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("uploads the same segment bytes after a lost response without conflict", async () => {
    const receiver = await createReceiver();
    receiver.dropNext(/PUT .*\/segments\/0$/, 1);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 2);
      await stopRecording(call);
      await flush(call);

      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("complete");
      const [recording] = [...receiver.recordings.values()];
      const id = recording?.id ?? "";
      expect(
        receiver.requests.filter(
          (request) =>
            request.method === "PUT" &&
            request.path === recordingSegmentPath(id, 0),
        ).length,
      ).toBeGreaterThanOrEqual(2);
      expect(receiver.requests.some((request) => request.status === 409)).toBe(
        false,
      );
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

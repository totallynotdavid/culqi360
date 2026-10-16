import { expect, test } from "@playwright/test";

import {
  closeExtensionSession,
  launchExtensionSession,
} from "./support/extension-fixture";
import { createReceiver } from "./support/receiver";
import {
  beginCall,
  rows,
  startRecording,
  stopRecording,
  waitForChunks,
} from "./support/scenario";

interface ObservedMessage {
  message: Record<string, unknown>;
  onDisk: boolean;
}

test.describe("the offscreen document writes each chunk to disk first", () => {
  test("messages the worker only the chunk key, after the row is stored", async () => {
    const receiver = await createReceiver();
    // Keep the chunks queued so the rows can be inspected.
    receiver.failNext(/PUT .*\/segments\//, 503, 10_000);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await call.popup.evaluate(() => {
        const observed: ObservedMessage[] = [];
        Reflect.set(window, "observedChunkMessages", observed);
        chrome.runtime.onMessage.addListener((message: unknown) => {
          if (
            typeof message !== "object" ||
            message === null ||
            Reflect.get(message, "type") !== "recording.chunk"
          ) {
            return;
          }
          const key = [
            Reflect.get(message, "recordingId"),
            Reflect.get(message, "seq"),
          ];
          const request = indexedDB.open("crm_extension");
          request.onsuccess = () => {
            const read = request.result
              .transaction("chunks")
              .objectStore("chunks")
              .get(key);
            read.onsuccess = () => {
              observed.push({
                message: { ...message },
                onDisk: read.result !== undefined,
              });
              request.result.close();
            };
          };
        });
      });

      await startRecording(call);
      await waitForChunks(call.popup, 3);
      await stopRecording(call);

      const observed = await call.popup.evaluate(() =>
        Reflect.get(window, "observedChunkMessages"),
      );
      expect(observed.length).toBeGreaterThanOrEqual(3);
      for (const entry of observed) {
        expect(Object.keys(entry.message).sort()).toEqual([
          "recordingId",
          "seq",
          "type",
        ]);
        expect(entry.onDisk).toBe(true);
      }
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("stores one row per second with its segment job in the same commit", async () => {
    const receiver = await createReceiver();
    receiver.failNext(/PUT .*\/segments\//, 503, 10_000);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 4);
      await stopRecording(call);

      const chunks = await rows(call.popup, "chunks");
      const seqs = chunks.map((chunk) => Number(chunk.seq));
      expect(seqs.sort((left, right) => left - right)).toEqual(
        seqs.map((_, index) => index),
      );
      for (const chunk of chunks) {
        expect(chunk.blobSize).toBeGreaterThan(0);
        expect(chunk.bytes).toBe(chunk.blobSize);
        expect(chunk.blobType).toMatch(/^audio\//);
        expect(chunk.channels).toBe("mic-left,tab-right");
      }
      const [first, second] = chunks.map((chunk) => Number(chunk.startedAt));
      expect((second ?? 0) - (first ?? 0)).toBeGreaterThan(500);
      expect((second ?? 0) - (first ?? 0)).toBeLessThan(2_000);

      const segmentJobs = (await rows(call.popup, "queue"))
        .map((row) => row.job as Record<string, unknown>)
        .filter((job) => job.kind === "recording.segment");
      expect(segmentJobs.map((job) => job.seq)).toEqual(
        expect.arrayContaining(seqs),
      );

      const [recording] = await rows(call.popup, "recordings");
      expect(recording).toMatchObject({
        callId: call.callId,
        status: "closing",
        interrupted: false,
      });
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

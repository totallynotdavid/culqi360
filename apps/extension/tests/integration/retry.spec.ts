import { expect, test, type Page } from "@playwright/test";

import {
  closeExtensionSession,
  launchExtensionSession,
  sendRuntimeMessage,
  stateOf,
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

interface QueueRowView {
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  job: { kind: string; id?: string; seq?: number };
}

async function queueOf(page: Page): Promise<QueueRowView[]> {
  const queue = await rows(page, "queue");
  return queue.map((row) => ({
    attempts: Number(row.attempts),
    nextAttemptAt: Number(row.nextAttemptAt),
    lastError: typeof row.lastError === "string" ? row.lastError : null,
    job: row.job as QueueRowView["job"],
  }));
}

test.describe("a failed upload is tried again", () => {
  test("backs off a 503 and delivers without a manual flush", async () => {
    const receiver = await createReceiver();
    receiver.failNext(/PUT .*\/segments\/0$/, 503, 1);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      const before = Date.now();
      await startRecording(call);
      await waitForChunks(call.popup, 2);

      const segmentZero = async () =>
        (await queueOf(call.popup)).find(
          (row) => row.job.kind === "recording.segment" && row.job.seq === 0,
        );
      await expect.poll(async () => (await segmentZero())?.attempts).toBe(1);
      const row = await segmentZero();
      const after = Date.now();
      expect(row?.lastError).toContain("503");
      // 2^1 s after the first failure.
      expect(row?.nextAttemptAt).toBeGreaterThanOrEqual(before + 2_000);
      expect(row?.nextAttemptAt).toBeLessThanOrEqual(after + 2_000);

      await expect
        .poll(
          () => [...receiver.recordings.values()][0]?.segments.has(0) ?? false,
          { timeout: 20_000 },
        )
        .toBe(true);
      await stopRecording(call);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("one failing recording segment does not hold back the events", async () => {
    const receiver = await createReceiver();
    receiver.failNext(/PUT .*\/segments\//, 503, 10_000);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 1);
      await sendRuntimeMessage(call.popup, {
        type: "call.end",
        outcome: "done",
      });

      await expect
        .poll(
          () =>
            receiver.events.some(
              (event) =>
                event.type === "call.lifecycle" &&
                event.payload.event === "ended",
            ),
          { timeout: 20_000 },
        )
        .toBe(true);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("a close that keeps answering missing waits between rounds", async () => {
    const receiver = await createReceiver();
    receiver.acknowledgeWithoutStoring([1]);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 3);
      await stopRecording(call);

      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("missing");
      const rounds = receiver.closes.length;
      await expect
        .poll(async () => {
          const waiting = (await queueOf(call.popup)).filter(
            (row) => row.job.kind !== "event",
          );
          return (
            waiting.length > 0 &&
            waiting.every((row) => row.nextAttemptAt > Date.now())
          );
        })
        .toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 1_200));
      expect(receiver.closes).toHaveLength(rounds);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("refreshes an expired session once and resends", async () => {
    const receiver = await createReceiver();
    receiver.failNext(/POST \/api\/extension\/events/, 401, 1);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await flush(call);

      await expect
        .poll(() => receiver.events.length, { timeout: 20_000 })
        .toBeGreaterThan(0);
      expect(
        receiver.requests.filter((r) => r.path.endsWith("/session/refresh")),
      ).toHaveLength(1);
      expect(receiver.events.every((e) => e.authorization !== null)).toBe(true);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("backs off a job the refreshed session still cannot send", async () => {
    const receiver = await createReceiver();
    receiver.failNext(/POST \/api\/extension\/events/, 401, 1_000);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await flush(call);

      const first = async () => (await queueOf(call.popup))[0];
      await expect
        .poll(async () => (await first())?.attempts)
        .toBeGreaterThanOrEqual(1);
      expect((await first())?.nextAttemptAt).toBeGreaterThan(Date.now());
      expect((await first())?.lastError).toContain("refreshed session");
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("stops without burning attempts when the refresh is refused", async () => {
    const receiver = await createReceiver();
    receiver.failNext(/POST \/api\/extension\/events/, 401, 1_000);
    receiver.failNext(/POST \/api\/extension\/session\/refresh/, 401, 1_000);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await flush(call);

      await expect
        .poll(async () => (await stateOf(call.popup)).sync.signedIn)
        .toBe(false);
      const queue = await queueOf(call.popup);
      expect(queue.length).toBeGreaterThan(0);
      expect(queue.every((row) => row.attempts === 0)).toBe(true);
      expect((await stateOf(call.popup)).queue.pending).toBeGreaterThan(0);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

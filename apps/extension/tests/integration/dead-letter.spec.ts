import { expect, test, type Page } from "@playwright/test";

import {
  closeExtensionSession,
  launchExtensionSession,
  openPopupPage,
  sendRuntimeMessage,
  stateOf,
} from "./support/extension-fixture";
import { createReceiver, type Receiver } from "./support/receiver";
import {
  beginCall,
  flush,
  rows,
  startRecording,
  stopRecording,
  waitForChunks,
  type CallScenario,
} from "./support/scenario";

interface QueueRowView {
  sequence: number;
  attempts: number;
  nextAttemptAt: number;
  deadAt: number | null;
  lastError: string | null;
  job: { kind: string; type?: string; seq?: number };
}

const EVENTS = /POST \/api\/extension\/events/;
const MAX_ATTEMPTS = 20;

async function queueOf(page: Page): Promise<QueueRowView[]> {
  const queue = await rows(page, "queue");
  return queue.map((row) => ({
    sequence: Number(row.sequence),
    attempts: Number(row.attempts),
    nextAttemptAt: Number(row.nextAttemptAt),
    deadAt: typeof row.deadAt === "number" ? row.deadAt : null,
    lastError: typeof row.lastError === "string" ? row.lastError : null,
    job: row.job as QueueRowView["job"],
  }));
}

async function headOfEvents(page: Page): Promise<QueueRowView | undefined> {
  return (await queueOf(page)).find((row) => row.job.kind === "event");
}

async function deadOf(page: Page): Promise<QueueRowView[]> {
  return (await queueOf(page)).filter((row) => row.deadAt !== null);
}

function eventRequests(receiver: Receiver): number {
  return receiver.requests.filter((request) =>
    EVENTS.test(`${request.method} ${request.path}`),
  ).length;
}

/** Queues one more event, so a fault scripted before it hits that event. */
async function endCall(call: CallScenario): Promise<void> {
  const ended = await sendRuntimeMessage(call.popup, {
    type: "call.end",
    outcome: "done",
  });
  expect(ended.ok).toBe(true);
}

async function retryDead(call: CallScenario): Promise<void> {
  const response = await sendRuntimeMessage(call.popup, {
    type: "queue.retryDead",
  });
  expect(response, JSON.stringify(response)).toMatchObject({ ok: true });
}

test.describe("a job the server will never accept is parked", () => {
  for (const status of [400, 404, 409, 422]) {
    test(`parks a ${status} as a dead letter with its error`, async () => {
      const receiver = await createReceiver();
      receiver.failNext(EVENTS, status, 1);
      const session = await launchExtensionSession();

      try {
        const call = await beginCall(session, receiver);
        await flush(call);

        await expect
          .poll(async () => (await deadOf(call.popup)).length)
          .toBe(1);
        const [dead] = await deadOf(call.popup);
        expect(dead?.lastError).toContain(String(status));
        expect(dead?.attempts).toBe(1);
        expect(dead?.job.kind).toBe("event");

        const { queue } = await stateOf(call.popup);
        expect(queue.dead).toBe(1);
        expect(queue.pending).toBe(0);
      } finally {
        await closeExtensionSession(session);
        await receiver.close();
      }
    });
  }

  test("a dead event does not hold back the events behind it", async () => {
    const receiver = await createReceiver();
    receiver.failNext(EVENTS, 400, 1);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await flush(call);

      await expect.poll(async () => (await deadOf(call.popup)).length).toBe(1);
      await expect
        .poll(() => receiver.events.length, { timeout: 20_000 })
        .toBeGreaterThan(0);
      expect(
        (await queueOf(call.popup)).filter((row) => row.deadAt === null),
      ).toHaveLength(0);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("a flush never resends a dead letter, only the agent's retry does", async () => {
    const receiver = await createReceiver();
    receiver.failNext(EVENTS, 400, 1);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await flush(call);
      await expect.poll(async () => (await deadOf(call.popup)).length).toBe(1);
      await expect.poll(async () => (await queueOf(call.popup)).length).toBe(1);
      const sent = eventRequests(receiver);

      await flush(call);
      await flush(call);
      expect(eventRequests(receiver)).toBe(sent);
      expect(await deadOf(call.popup)).toHaveLength(1);

      await retryDead(call);
      await expect.poll(async () => (await deadOf(call.popup)).length).toBe(0);
      expect(eventRequests(receiver)).toBe(sent + 1);
      expect((await stateOf(call.popup)).queue.dead).toBe(0);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("the dashboard shows the count and retries from a button", async () => {
    const receiver = await createReceiver();
    receiver.failNext(EVENTS, 400, 1);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await expect.poll(async () => (await deadOf(call.popup)).length).toBe(1);
      const dashboard = await openPopupPage(session);

      await expect(dashboard.getByTestId("dead-letters")).toContainText(
        "Failed jobs: 1",
        { timeout: 10_000 },
      );
      await dashboard
        .getByRole("button", { name: "Retry failed jobs" })
        .click();

      await expect(dashboard.getByTestId("dead-letters")).toBeHidden({
        timeout: 10_000,
      });
      expect(await deadOf(call.popup)).toHaveLength(0);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("a close waits for a dead segment and completes once it is retried", async () => {
    const receiver = await createReceiver();
    receiver.failNext(/PUT .*\/segments\/0$/, 400, 1);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 2);
      await stopRecording(call);

      await expect.poll(async () => (await deadOf(call.popup)).length).toBe(1);
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      expect(receiver.closes).toHaveLength(0);

      await retryDead(call);
      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("complete");
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

test.describe("only a failure that may pass is retried", () => {
  for (const status of [408, 425, 429, 500, 503]) {
    test(`retries a ${status} and delivers it later`, async () => {
      const receiver = await createReceiver();
      const session = await launchExtensionSession();

      try {
        const call = await beginCall(session, receiver);
        await expect
          .poll(async () => (await queueOf(call.popup)).length)
          .toBe(0);
        receiver.failNext(EVENTS, status, 1_000);
        await endCall(call);

        await expect
          .poll(async () => (await headOfEvents(call.popup))?.attempts)
          .toBeGreaterThanOrEqual(1);
        const row = await headOfEvents(call.popup);
        expect(row?.deadAt).toBeNull();
        expect(row?.nextAttemptAt).toBeGreaterThan(Date.now());
        expect((await stateOf(call.popup)).queue.dead).toBe(0);

        receiver.clearFaults();
        await flush(call);
        await expect
          .poll(async () => (await queueOf(call.popup)).length)
          .toBe(0);
      } finally {
        await closeExtensionSession(session);
        await receiver.close();
      }
    });
  }

  test("retries a dropped connection", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await expect.poll(async () => (await queueOf(call.popup)).length).toBe(0);
      receiver.dropNext(EVENTS, 1_000);
      await endCall(call);

      await expect
        .poll(async () => (await headOfEvents(call.popup))?.attempts)
        .toBeGreaterThanOrEqual(1);
      expect((await headOfEvents(call.popup))?.deadAt).toBeNull();
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

test.describe("repeated failures", () => {
  test("park the job at the twentieth failure", async () => {
    const receiver = await createReceiver();
    receiver.failNext(EVENTS, 503, 10_000);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);

      let head = await headOfEvents(call.popup);
      for (let round = 0; round < MAX_ATTEMPTS + 5 && !head?.deadAt; round++) {
        // oxlint-disable-next-line no-await-in-loop -- each flush is one attempt
        await flush(call);
        // oxlint-disable-next-line no-await-in-loop -- each flush is one attempt
        head = await headOfEvents(call.popup);
      }

      const [dead] = await deadOf(call.popup);
      expect(dead?.attempts).toBe(MAX_ATTEMPTS);
      expect(dead?.lastError).toContain("503");
      expect((await stateOf(call.popup)).queue.dead).toBeGreaterThanOrEqual(1);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("wait a random time below the five minute cap", async () => {
    const receiver = await createReceiver();
    receiver.failNext(EVENTS, 503, 10_000);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      const delays: number[] = [];

      for (let round = 1; round <= 16; round++) {
        const before = Date.now();
        // oxlint-disable-next-line no-await-in-loop -- each flush is one attempt
        await flush(call);
        const after = Date.now();
        // oxlint-disable-next-line no-await-in-loop -- each flush is one attempt
        const head = await headOfEvents(call.popup);
        if (head && head.attempts >= 10 && head.deadAt === null) {
          // The delay lies between these two bounds, whenever in the flush the
          // failure was recorded.
          expect(head.nextAttemptAt - before).toBeGreaterThanOrEqual(150_000);
          expect(head.nextAttemptAt - after).toBeLessThanOrEqual(300_000);
          delays.push(head.nextAttemptAt - before);
        }
      }

      expect(delays.length).toBeGreaterThanOrEqual(4);
      expect(Math.max(...delays) - Math.min(...delays)).toBeGreaterThan(5_000);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

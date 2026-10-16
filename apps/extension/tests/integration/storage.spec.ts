import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  closeExtensionSession,
  dumpDatabase,
  launchExtensionSession,
  openPopupPage,
  sendRuntimeMessage,
  serviceWorkerOf,
} from "./support/extension-fixture";
import { openOffscreenDocument } from "./support/offscreen";
import { createReceiver } from "./support/receiver";
import {
  beginCall,
  rows,
  startRecording,
  stopRecording,
  waitForChunks,
} from "./support/scenario";

test.describe("one IndexedDB store holds all durable state", () => {
  test("storage.local keeps only the installation session", async () => {
    const receiver = await createReceiver();
    receiver.failNext(/POST \/api\/extension\/events/, 503, 1_000);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);

      const local = await call.worker.evaluate(() =>
        chrome.storage.local.get(null),
      );
      const keys = Object.keys(local);
      expect(keys).toHaveLength(1);
      expect(local[keys[0] ?? ""]).toMatchObject({
        origin: receiver.origin,
        sessionToken: expect.any(String),
        refreshToken: expect.any(String),
        installationId: expect.any(String),
      });

      const databases = await call.popup.evaluate(async () =>
        (await indexedDB.databases()).map((database) => database.name),
      );
      expect(databases).toEqual(["crm_extension"]);

      const dump = await dumpDatabase(call.popup);
      expect(Object.keys(dump?.stores ?? {}).sort()).toEqual(
        expect.arrayContaining(["calls", "chunks", "queue", "recordings"]),
      );
      expect(await rows(call.popup, "calls")).toMatchObject([
        { id: call.callId, phase: "active" },
      ]);
      expect((await rows(call.popup, "queue")).length).toBeGreaterThan(0);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("numbers concurrent writes without gaps or duplicates", async () => {
    const receiver = await createReceiver();
    // Keep every event queued so the sequence numbers stay visible.
    receiver.failNext(/POST \/api\/extension\/events/, 503, 1_000);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      const before = (await rows(call.popup, "queue")).length;

      const ended = await Promise.all([
        sendRuntimeMessage(call.popup, { type: "call.end", outcome: "a" }),
        sendRuntimeMessage(call.popup, { type: "call.end", outcome: "b" }),
        sendRuntimeMessage(call.popup, { type: "call.end", outcome: "c" }),
      ]);
      expect(ended.filter((response) => response.ok)).toHaveLength(1);

      const queue = await rows(call.popup, "queue");
      const sequences = queue
        .map((row) => Number(row.sequence))
        .sort((left, right) => left - right);
      expect(sequences).toEqual(
        Array.from({ length: sequences.length }, (_, index) => index + 1),
      );
      expect(queue.length).toBeGreaterThan(before);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

test.describe("the database is protected from quota and eviction", () => {
  test("the extension's quota is lifted above an ordinary page's", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const worker = await serviceWorkerOf(session.context);
      const page = await session.context.newPage();
      await page.goto(`${receiver.origin}/`);

      const estimateQuota = async () =>
        (await navigator.storage.estimate()).quota ?? 0;
      // An ordinary page gets 10 GiB here. With `unlimitedStorage` the quota
      // follows the free disk, so this needs a host with more than 20 GiB.
      const pageQuota = await page.evaluate(estimateQuota);
      expect(await worker.evaluate(estimateQuota)).toBeGreaterThan(
        2 * pageQuota,
      );
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("the recorder asks the browser for persistent storage before it saves audio", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const offscreen = await openOffscreenDocument(session);
      await offscreen.evaluate(`(() => {
        globalThis.persistCalls = 0;
        const persist = StorageManager.prototype.persist;
        StorageManager.prototype.persist = function () {
          globalThis.persistCalls += 1;
          return persist.call(this);
        };
      })()`);

      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 1);

      expect(await offscreen.evaluate<number>("persistCalls")).toBe(1);
      await stopRecording(call);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

test.describe("a stored v1 queue is migrated on first start", () => {
  test("carries the queue, the session and the journal payloads over", async () => {
    const receiver = await createReceiver();
    const userDataDir = await mkdtemp(
      path.join(os.tmpdir(), "crm-extension-migrate-"),
    );
    const installationId = "11111111-1111-4111-8111-111111111111";
    const sessionToken = "v1-session-token";
    receiver.allowSessionToken(sessionToken, installationId);

    const first = await launchExtensionSession({ userDataDir });
    try {
      const popup = await openPopupPage(first);
      await popup.evaluate(
        async ({ origin, installation, token }) => {
          const now = Date.now();
          const job = (
            id: string,
            sequence: number,
            type: string,
            payload: Record<string, unknown>,
          ) => ({
            id,
            sequence,
            type,
            payload,
            createdAt: now,
            attemptCount: 3,
            nextAttemptAt: now,
            lastError: "sync failed with status 503",
          });
          await chrome.storage.local.set({
            crm_extension_state_v1: {
              schemaVersion: 1,
              installationId: installation,
              nextEventSequence: 8,
              handoff: null,
              currentCall: null,
              previousCallEndedAt: null,
              recording: {
                phase: "idle",
                streamId: null,
                startedAt: null,
                stoppedAt: null,
                error: null,
                chunkCount: 0,
              },
              queue: [
                job("v1-event-a", 5, "call.lifecycle", { state: "ended" }),
                job("v1-chunk-b", 6, "recording.chunk", {
                  sessionId: "old-session",
                  chunkId: "old-chunk",
                  mimeType: "audio/webm",
                  durationMs: 4000,
                  createdAt: now,
                  payloadStorage: "indexeddb",
                }),
                job("v1-event-c", 7, "executive.presence", { status: "idle" }),
              ],
              syncConfig: {
                apiBaseUrl: `${origin}/api`,
                sessionToken: token,
                refreshToken: "v1-refresh-token",
              },
              sync: { lastSyncAt: null, lastSyncError: null },
            },
          });

          const journal = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("crm_extension_journal_v1", 1);
            request.onupgradeneeded = () =>
              request.result.createObjectStore("payloads", {
                keyPath: "jobId",
              });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          await new Promise<void>((resolve, reject) => {
            const transaction = journal.transaction("payloads", "readwrite");
            transaction.objectStore("payloads").put({
              jobId: "v1-chunk-b",
              payload: {
                sessionId: "old-session",
                chunkId: "old-chunk",
                mimeType: "audio/webm",
                dataBase64: "AAEC",
                durationMs: 4000,
                createdAt: now,
              },
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          });
          journal.close();
        },
        {
          origin: receiver.origin,
          installation: installationId,
          token: sessionToken,
        },
      );
    } finally {
      await closeExtensionSession(first, { cleanupUserDataDir: false });
    }

    const second = await launchExtensionSession({ userDataDir });
    try {
      const popup = await openPopupPage(second);
      const worker = await serviceWorkerOf(second.context);

      await expect
        .poll(
          async () => (await dumpDatabase(popup))?.stores.queue?.length ?? 0,
        )
        .toBeGreaterThanOrEqual(3);

      const local = await worker.evaluate(() => chrome.storage.local.get(null));
      expect(Object.keys(local)).not.toContain("crm_extension_state_v1");
      expect(Object.values(local)).toMatchObject([
        {
          installationId,
          origin: receiver.origin,
          sessionToken,
          refreshToken: "v1-refresh-token",
        },
      ]);

      const journalLeft = await popup.evaluate(async () =>
        (await indexedDB.databases()).some(
          (database) => database.name === "crm_extension_journal_v1",
        ),
      );
      expect(journalLeft).toBe(false);

      const flushed = await sendRuntimeMessage(popup, { type: "sync.flush" });
      expect(flushed.ok).toBe(true);
      await expect
        .poll(() => receiver.events.map((event) => event.id).sort())
        .toEqual(["v1-chunk-b", "v1-event-a", "v1-event-c"]);

      const chunk = receiver.events.find((event) => event.id === "v1-chunk-b");
      expect(chunk).toMatchObject({
        sequence: 6,
        type: "recording.chunk",
        payload: { chunkId: "old-chunk", dataBase64: "AAEC" },
      });

      // Events queued after the migration continue the v1 numbering.
      const nextSequence = (await rows(popup, "meta")).find(
        (row) => row.key === "nextSequence",
      );
      expect(nextSequence?.value).toBe(8);
    } finally {
      await closeExtensionSession(second);
      await receiver.close();
      await rm(userDataDir, { recursive: true, force: true });
    }
  });
});

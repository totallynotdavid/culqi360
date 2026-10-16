import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test, type Worker } from "@playwright/test";

import {
  closeExtensionSession,
  launchExtensionSession,
  openPopupPage,
  sendRuntimeMessage,
} from "./support/extension-fixture";
import { openOffscreenDocument } from "./support/offscreen";
import { createReceiver } from "./support/receiver";
import {
  beginCall,
  rows,
  startRecording,
  waitForChunks,
} from "./support/scenario";

/**
 * Fires the sync alarm in a second, as the one-minute alarm does. An unpacked
 * extension has no minimum alarm delay.
 */
function fireSyncAlarm(worker: Worker) {
  return worker.evaluate(() =>
    chrome.alarms.create("crm.sync", { when: Date.now() + 200 }),
  );
}

test.describe("a recording whose recorder died is closed as interrupted", () => {
  test("after the browser restarts mid-recording", async () => {
    const receiver = await createReceiver();
    const userDataDir = await mkdtemp(
      path.join(os.tmpdir(), "crm-extension-restart-"),
    );

    const first = await launchExtensionSession({ userDataDir });
    let storedChunks = 0;
    try {
      const call = await beginCall(first, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 3);
      storedChunks = (await rows(call.popup, "chunks")).length;
    } finally {
      await closeExtensionSession(first, { cleanupUserDataDir: false });
    }

    const second = await launchExtensionSession({ userDataDir });
    try {
      const popup = await openPopupPage(second);
      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("complete");

      const close = receiver.closes.at(-1);
      expect(close?.manifest.interrupted).toBe(true);
      expect(close?.manifest.segments).toBeGreaterThanOrEqual(storedChunks);
      const [recording] = await rows(popup, "recordings");
      expect(recording).toMatchObject({
        status: "complete",
        interrupted: true,
      });
    } finally {
      await closeExtensionSession(second);
      await receiver.close();
      await rm(userDataDir, { recursive: true, force: true });
    }
  });

  test("when the recorder's document is lost and the worker lives on", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 2);

      await call.worker.evaluate(() => chrome.offscreen.closeDocument());
      await fireSyncAlarm(call.worker);

      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("complete");
      expect(receiver.closes.at(-1)?.manifest.interrupted).toBe(true);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("never while the recorder still holds its lock", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 2);

      await fireSyncAlarm(call.worker);
      const before = (await rows(call.popup, "chunks")).length;
      await new Promise((resolve) => setTimeout(resolve, 3_000));

      expect(receiver.closes).toHaveLength(0);
      const [recording] = await rows(call.popup, "recordings");
      expect(recording).toMatchObject({ status: "recording" });
      expect((await rows(call.popup, "chunks")).length).toBeGreaterThan(before);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("a second recorder for the same call is refused", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const offscreen = await openOffscreenDocument(session);
      const call = await beginCall(session, receiver);
      await offscreen.evaluate(`new Promise((granted) =>
        navigator.locks.request(${JSON.stringify(`recording:${call.callId}`)}, () => {
          granted(true);
          return new Promise(() => undefined);
        }))`);

      const started = await sendRuntimeMessage(call.popup, {
        type: "recording.start",
        tabId: call.callTabId,
      });

      expect(started.ok).toBe(false);
      expect(started.ok ? "" : started.error).toContain("already holds");
      expect(await rows(call.popup, "recordings")).toHaveLength(0);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

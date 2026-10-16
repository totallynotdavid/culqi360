import { expect, test } from "@playwright/test";

import {
  closeExtensionSession,
  launchExtensionSession,
  openPopupPage,
  sendRuntimeMessage,
  stateOf,
} from "./support/extension-fixture";
import { createReceiver } from "./support/receiver";
import {
  beginCall,
  rows,
  startRecording,
  stopRecording,
  waitForChunks,
} from "./support/scenario";

test.describe("a recording belongs to the live call", () => {
  test("refuses to record without a live call or twice for one call", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const popup = await openPopupPage(session);
      const early = await sendRuntimeMessage(popup, {
        type: "recording.start",
        tabId: 1,
      });
      expect(early.ok).toBe(false);

      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 1);
      const again = await sendRuntimeMessage(call.popup, {
        type: "recording.start",
        tabId: call.callTabId,
      });
      expect(again.ok).toBe(false);

      await stopRecording(call);
      const afterStop = await sendRuntimeMessage(call.popup, {
        type: "recording.start",
        tabId: call.callTabId,
      });
      expect(afterStop.ok).toBe(false);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("shows the recording and its saved chunks on the dashboard", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 2);

      const page = await openPopupPage(session);
      const state = page
        .locator("p", { hasText: "State" })
        .locator("strong")
        .first();
      await expect(state).toHaveText("recording", { timeout: 10_000 });
      expect((await stateOf(call.popup)).recording.chunkCount).toBeGreaterThan(
        0,
      );

      await stopRecording(call);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("closes a recording that is stopped at once, even with no audio yet", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await stopRecording(call);

      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("complete");
      expect(receiver.closes.at(-1)?.manifest.segments).toBe(0);
      expect(receiver.recordings.size).toBe(1);
      await expect
        .poll(async () => (await stateOf(call.popup)).recording.phase)
        .toBe("complete");
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("refuses a recording whose call ended while the capture was starting", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await call.worker.evaluate(() => {
        Reflect.set(
          globalThis,
          "holdCapture",
          new Promise<void>((resolve) => {
            Reflect.set(globalThis, "releaseCapture", resolve);
          }),
        );
      });

      const starting = sendRuntimeMessage(call.popup, {
        type: "recording.start",
        tabId: call.callTabId,
      });
      const ended = await sendRuntimeMessage(call.popup, {
        type: "call.end",
        outcome: "done",
      });
      expect(ended.ok).toBe(true);
      await call.worker.evaluate(() => {
        Reflect.get(globalThis, "releaseCapture")();
      });

      const started = await starting;
      expect(started.ok).toBe(false);
      expect(await rows(call.popup, "recordings")).toHaveLength(0);
      expect(
        receiver.requests.filter((r) => r.path === "/api/extension/recordings"),
      ).toHaveLength(0);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("keeps a recording closed that stopped while the server was creating it", async () => {
    const receiver = await createReceiver();
    const releaseCreate = receiver.holdNext(
      /^POST \/api\/extension\/recordings$/,
    );
    const releaseClose = receiver.holdNext(/^POST .*\/close$/);
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await expect
        .poll(() =>
          receiver.requests.some(
            (request) =>
              request.method === "POST" &&
              request.path === "/api/extension/recordings",
          ),
        )
        .toBe(true);
      await stopRecording(call);
      releaseCreate();

      await expect
        .poll(() => receiver.requests.some((r) => r.path.endsWith("/close")))
        .toBe(true);
      const [recording] = await rows(call.popup, "recordings");
      expect(recording).toMatchObject({
        status: "closing",
        interrupted: false,
      });
      expect(recording?.remoteId).toEqual(expect.any(String));
      releaseClose();
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("stops recording when the call ends", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);
      await waitForChunks(call.popup, 2);

      const ended = await sendRuntimeMessage(call.popup, {
        type: "call.end",
        outcome: "done",
      });
      expect(ended.ok).toBe(true);
      await expect
        .poll(() => receiver.closes.at(-1)?.answer.status, { timeout: 30_000 })
        .toBe("complete");
      expect(receiver.closes.at(-1)?.manifest.interrupted).toBe(false);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

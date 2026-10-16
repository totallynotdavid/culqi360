import { expect, test, type Worker } from "@playwright/test";

import {
  closeExtensionSession,
  launchExtensionSession,
  openPopupPage,
  pressRecordingShortcut,
  sendRuntimeMessage,
  stateOf,
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

const RESUME_NOTICE =
  "Click the extension icon on the call tab to resume recording";

const BLOCKED_TAB = "Cannot capture a tab with an active stream";

function badgeOf(worker: Worker): Promise<string> {
  return worker.evaluate(() => chrome.action.getBadgeText({}));
}

test.describe("a capture starts from an activeTab invocation", () => {
  test("the shortcut on the call tab starts the recording", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      expect(await rows(call.popup, "recordings")).toHaveLength(0);

      await pressRecordingShortcut(session, call.callTab);

      await waitForChunks(call.popup, 2);
      expect(await rows(call.popup, "recordings")).toMatchObject([
        { callId: call.callId, status: "recording" },
      ]);
      expect((await stateOf(call.popup)).recording.phase).toBe("recording");
      await stopRecording(call);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("the recorder's document exists before the stream id is requested", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await startRecording(call);

      expect(
        await call.worker.evaluate(() =>
          Reflect.get(globalThis, "offscreenAtRequest"),
        ),
      ).toBe(true);
      await stopRecording(call);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("the toolbar badge and the dashboard ask for a click while no recording runs", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await expect.poll(() => badgeOf(call.worker)).not.toBe("");
      await expect(call.popup.getByText(RESUME_NOTICE)).toBeVisible({
        timeout: 10_000,
      });

      await startRecording(call);
      await expect.poll(() => badgeOf(call.worker)).toBe("");
      await expect(call.popup.getByText(RESUME_NOTICE)).toBeHidden({
        timeout: 10_000,
      });

      await stopRecording(call);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("the badge is clear when no call is live", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await expect.poll(() => badgeOf(call.worker)).not.toBe("");

      const ended = await sendRuntimeMessage(call.popup, {
        type: "call.end",
        outcome: "done",
      });
      expect(ended.ok).toBe(true);
      await expect.poll(() => badgeOf(call.worker)).toBe("");
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("the dashboard records the tab that is active when the agent clicks", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      const dashboard = await openPopupPage(session);

      await dashboard.getByRole("button", { name: "Record this tab" }).click();

      await expect
        .poll(async () => (await stateOf(call.popup)).recording.phase)
        .toBe("recording");
      await stopRecording(call);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("a capture that cannot open its stream is reported once and not retried", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const offscreen = await openOffscreenDocument(session);
      await offscreen.evaluate(
        `globalThis.captureFailure = ${JSON.stringify(BLOCKED_TAB)}`,
      );
      const call = await beginCall(session, receiver);

      const started = await sendRuntimeMessage(call.popup, {
        type: "recording.start",
        tabId: call.callTabId,
      });
      expect(started.ok).toBe(false);
      expect(started.ok ? "" : started.error).toContain(BLOCKED_TAB);

      expect((await stateOf(call.popup)).recording).toMatchObject({
        phase: "idle",
        captureError: expect.stringContaining(BLOCKED_TAB),
      });
      const dashboard = await openPopupPage(session);
      await expect(dashboard.getByText(BLOCKED_TAB)).toBeVisible({
        timeout: 10_000,
      });

      await new Promise((resolve) => setTimeout(resolve, 3_000));
      expect(
        await call.worker.evaluate(() =>
          Reflect.get(globalThis, "streamRequests"),
        ),
      ).toBe(1);
      expect(await rows(call.popup, "recordings")).toHaveLength(0);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("a later start clears the reason of an earlier failure", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const offscreen = await openOffscreenDocument(session);
      await offscreen.evaluate(
        `globalThis.captureFailure = ${JSON.stringify(BLOCKED_TAB)}`,
      );
      const call = await beginCall(session, receiver);
      const failed = await sendRuntimeMessage(call.popup, {
        type: "recording.start",
        tabId: call.callTabId,
      });
      expect(failed.ok).toBe(false);

      await startRecording(call);
      await waitForChunks(call.popup, 1);
      expect((await stateOf(call.popup)).recording.captureError).toBeNull();
      await stopRecording(call);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

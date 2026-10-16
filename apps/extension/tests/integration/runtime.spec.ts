import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  closeExtensionSession,
  handOff,
  launchExtensionSession,
  openPopupPage,
  sendRuntimeMessage,
  stateOf,
} from "./support/extension-fixture";
import { createReceiver } from "./support/receiver";
import { beginCall } from "./support/scenario";

test.describe("call lifecycle", () => {
  test("renders the dashboard and polls runtime state", async () => {
    const receiver = await createReceiver();
    receiver.failNext(/POST \/api\/extension\/events/, 503, 1_000);
    const session = await launchExtensionSession();

    try {
      const page = await openPopupPage(session);
      const queueJobs = page
        .locator("p", { hasText: "Queued jobs" })
        .locator("strong");
      await expect(
        page.getByRole("heading", { name: "Assigned call companion" }),
      ).toBeVisible();
      await expect(queueJobs).toHaveText("0");

      const handed = await handOff(session, receiver);
      expect(handed.response.ok).toBe(true);
      const started = await sendRuntimeMessage(page, { type: "call.start" });
      expect(started.ok).toBe(true);

      // Runtime state is not pushed: the dashboard polls every 2.5 seconds.
      await expect(queueJobs).not.toHaveText("0", { timeout: 6_000 });
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("rejects invalid call transitions", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const page = await openPopupPage(session);
      const startWithoutHandoff = await sendRuntimeMessage(page, {
        type: "call.start",
      });
      expect(startWithoutHandoff.ok).toBe(false);
      const connectBeforeStart = await sendRuntimeMessage(page, {
        type: "call.connected",
      });
      expect(connectBeforeStart.ok).toBe(false);

      await handOff(session, receiver);
      expect((await sendRuntimeMessage(page, { type: "call.start" })).ok).toBe(
        true,
      );
      expect((await sendRuntimeMessage(page, { type: "call.start" })).ok).toBe(
        false,
      );
      expect(
        (
          await sendRuntimeMessage(page, {
            type: "call.end",
            outcome: "no_answer",
          })
        ).ok,
      ).toBe(true);
      expect(
        (await sendRuntimeMessage(page, { type: "call.connected" })).ok,
      ).toBe(false);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("delivers the call's events to the server in order", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const call = await beginCall(session, receiver);
      await sendRuntimeMessage(call.popup, {
        type: "call.end",
        outcome: "no_answer",
        notes: "integration-test",
      });

      await expect
        .poll(
          () =>
            receiver.events.filter((event) => event.type === "call.lifecycle")
              .length,
          { timeout: 20_000 },
        )
        .toBe(3);
      const lifecycle = receiver.events
        .filter((event) => event.type === "call.lifecycle")
        .map((event) => event.payload);
      expect(lifecycle.map((payload) => payload.event)).toEqual([
        "started",
        "connected",
        "ended",
      ]);
      expect(
        lifecycle.every((payload) => payload.sessionId === call.callId),
      ).toBe(true);
      // Ending the call also queues metric and presence events after these.
      await expect
        .poll(async () => (await stateOf(call.popup)).queue.pending, {
          timeout: 20_000,
        })
        .toBe(0);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("keeps the call across a browser restart and recreates the alarm", async () => {
    const receiver = await createReceiver();
    const userDataDir = await mkdtemp(
      path.join(os.tmpdir(), "crm-extension-restart-"),
    );
    const first = await launchExtensionSession({ userDataDir });
    let callId = "";

    try {
      const call = await beginCall(first, receiver);
      callId = call.callId;
    } finally {
      await closeExtensionSession(first, { cleanupUserDataDir: false });
    }

    const second = await launchExtensionSession({ userDataDir });
    try {
      const page = await openPopupPage(second);
      const state = await stateOf(page);
      expect(state.call).toMatchObject({ id: callId, phase: "active" });
      expect(state.sync.signedIn).toBe(true);

      const alarm = await page.evaluate(() => chrome.alarms.get("crm.sync"));
      expect(alarm).not.toBeNull();
    } finally {
      await closeExtensionSession(second);
      await receiver.close();
      await rm(userDataDir, { recursive: true, force: true });
    }
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import {
  closeExtensionSession,
  launchExtensionSession,
  openPopupPage,
  sendRuntimeMessage,
} from "./support/extension-fixture";
import { createSyncSink } from "./support/sync-sink";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_OUTPUT_PATH = path.resolve(
  currentDirectory,
  "../../.output/chrome-mv3",
);

test.describe("extension runtime integration", () => {
  test("popup renders the dashboard and polls runtime state", async () => {
    const session = await launchExtensionSession({
      extensionOutputPath: EXTENSION_OUTPUT_PATH,
    });

    try {
      const page = await openPopupPage(session.context, session.extensionId);
      const queueJobs = page
        .locator("p", { hasText: "Queue jobs" })
        .locator("strong");

      await expect(
        page.getByRole("heading", { name: "Assigned call companion" }),
      ).toBeVisible();
      await expect(queueJobs).toHaveText("0");

      const callStarted = await sendRuntimeMessage(page, {
        type: "call.start",
        assignmentId: "0192f3a0-1111-7a10-8a10-00000000a010",
        contactId: "0192f3a0-1111-7a20-8a20-00000000c020",
        phone: "+51933333333",
      });
      expect(callStarted.ok).toBe(true);

      // Runtime state changes are not pushed to the dashboard.
      // The dashboard polls every 2.5 seconds.
      await expect(queueJobs).not.toHaveText("0", { timeout: 6_000 });
    } finally {
      await closeExtensionSession(session);
    }
  });

  test("rejects invalid call and recording transitions", async () => {
    const session = await launchExtensionSession({
      extensionOutputPath: EXTENSION_OUTPUT_PATH,
    });

    try {
      const page = await openPopupPage(session.context, session.extensionId);

      const connectBeforeStart = await sendRuntimeMessage(page, {
        type: "call.connected",
      });
      expect(connectBeforeStart.ok).toBe(false);

      const callStarted = await sendRuntimeMessage(page, {
        type: "call.start",
        assignmentId: "0192f3a0-1111-7a10-8a10-00000000a010",
        contactId: "0192f3a0-1111-7a20-8a20-00000000c020",
        phone: "+51933333333",
      });
      expect(callStarted.ok).toBe(true);

      const callEnded = await sendRuntimeMessage(page, {
        type: "call.end",
        outcome: "no_answer",
      });
      expect(callEnded.ok).toBe(true);

      const connectAfterEnd = await sendRuntimeMessage(page, {
        type: "call.connected",
      });
      expect(connectAfterEnd.ok).toBe(false);

      const startRecordingAfterEnd = await sendRuntimeMessage(page, {
        type: "recording.start",
        tabId: 1,
      });
      expect(startRecordingAfterEnd.ok).toBe(false);
    } finally {
      await closeExtensionSession(session);
    }
  });

  test("flushes queued call lifecycle events to a real HTTP endpoint", async () => {
    const sink = await createSyncSink();
    const session = await launchExtensionSession({
      extensionOutputPath: EXTENSION_OUTPUT_PATH,
    });

    try {
      const page = await openPopupPage(session.context, session.extensionId);

      await expect
        .poll(async () => {
          const response = await sendRuntimeMessage(page, {
            type: "state.get",
          });
          return response.ok;
        })
        .toBe(true);

      await sendRuntimeMessage(page, {
        type: "call.start",
        assignmentId: "0192f3a0-2222-7a10-8a10-00000000a101",
        contactId: "0192f3a0-2222-7a20-8a20-00000000c202",
        phone: "+51911111111",
      });
      await sendRuntimeMessage(page, { type: "call.connected" });
      await sendRuntimeMessage(page, {
        type: "call.end",
        outcome: "no_answer",
        notes: "integration-test",
      });

      const configResponse = await sendRuntimeMessage(page, {
        type: "sync.configure",
        apiBaseUrl: sink.baseUrl,
        sessionToken: "test-token",
        refreshToken: "refresh-token",
      });
      expect(configResponse.ok).toBe(true);

      const flushResponse = await sendRuntimeMessage(page, {
        type: "sync.flush",
      });
      expect(flushResponse.ok).toBe(true);

      await expect
        .poll(() => sink.events.length, { timeout: 20_000 })
        .toBeGreaterThanOrEqual(4);

      const stateResponse = await sendRuntimeMessage(page, {
        type: "state.get",
      });
      if (!stateResponse.ok) {
        throw new Error(stateResponse.error);
      }

      expect(stateResponse.state.queue).toHaveLength(0);
      expect(
        sink.events.every(
          (event) => event.authorization === "Bearer test-token",
        ),
      ).toBe(true);

      const eventTypes = sink.events.map((event) => {
        const body = event.body as Record<string, unknown>;
        return String(body.type);
      });
      expect(eventTypes).toContain("call.lifecycle");
      expect(eventTypes).toContain("call.metric");
    } finally {
      await closeExtensionSession(session);
      await sink.close();
    }
  });

  test("persists call state across browser restart and recreates alarms", async () => {
    const userDataDir = await mkdtemp(
      path.join(os.tmpdir(), "crm-extension-restart-"),
    );

    const firstSession = await launchExtensionSession({
      extensionOutputPath: EXTENSION_OUTPUT_PATH,
      userDataDir,
    });

    try {
      const firstPage = await openPopupPage(
        firstSession.context,
        firstSession.extensionId,
      );
      const startResponse = await sendRuntimeMessage(firstPage, {
        type: "call.start",
        assignmentId: "0192f3a0-3333-7a10-8a10-00000000a777",
        contactId: "0192f3a0-3333-7a20-8a20-00000000c888",
        phone: "+51922222222",
      });
      expect(startResponse.ok).toBe(true);
    } finally {
      await closeExtensionSession(firstSession, { cleanupUserDataDir: false });
    }

    const secondSession = await launchExtensionSession({
      extensionOutputPath: EXTENSION_OUTPUT_PATH,
      userDataDir,
    });

    try {
      const secondPage = await openPopupPage(
        secondSession.context,
        secondSession.extensionId,
      );
      const stateResponse = await sendRuntimeMessage(secondPage, {
        type: "state.get",
      });
      if (!stateResponse.ok) {
        throw new Error(stateResponse.error);
      }

      expect(stateResponse.state.currentCall?.assignmentId).toBe(
        "0192f3a0-3333-7a10-8a10-00000000a777",
      );
      expect(stateResponse.state.currentCall?.phase).toBe("dialing");

      const alarm = await secondPage.evaluate(async () => {
        return chrome.alarms.get("crm.sync");
      });
      expect(alarm).not.toBeNull();
    } finally {
      await closeExtensionSession(secondSession, { cleanupUserDataDir: false });
      await rm(userDataDir, { recursive: true, force: true });
    }
  });
});

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
import { rows } from "./support/scenario";

test.describe("the server verifies the handoff, not the extension", () => {
  test("claims a token whose signature the extension cannot check", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const popup = await openPopupPage(session);
      const { response } = await handOff(session, receiver);
      expect(response).toMatchObject({
        ok: true,
        executiveState: { presenceStatus: "ready" },
      });

      const claim = receiver.requests.filter((request) =>
        request.path.endsWith("/session/claim"),
      );
      expect(claim).toHaveLength(1);

      const state = await stateOf(popup);
      expect(state.call).toMatchObject({
        id: receiver.callIds[0],
        phase: "ready",
        phone: "+51911111111",
        clientName: "Ana Quispe",
      });
      expect(state.sync.signedIn).toBe(true);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("surfaces the server's rejection and keeps no call", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const popup = await openPopupPage(session);
      const { response } = await handOff(session, receiver, "forged.token.sig");
      expect(response).toMatchObject({
        ok: false,
        error: expect.any(String),
      });

      const token = receiver.issueHandoff();
      receiver.failNext(/POST .*\/session\/claim/, 401, 1);
      const rejected = await handOff(session, receiver, token);
      expect(rejected.response).toMatchObject({
        ok: false,
        error: expect.stringContaining("401"),
      });

      expect(await rows(popup, "calls")).toEqual([]);
      expect((await stateOf(popup)).sync.signedIn).toBe(false);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("a second delivery of the same token keeps the one call", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const popup = await openPopupPage(session);
      const token = receiver.issueHandoff();
      const first = await handOff(session, receiver, token);
      const second = await handOff(session, receiver, token);
      expect(first.response.ok).toBe(true);
      expect(second.response.ok).toBe(true);
      expect(await rows(popup, "calls")).toHaveLength(1);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("keeps the stored session when a call went live during the claim", async () => {
    const receiver = await createReceiver();
    const releaseClaim = receiver.holdNext(/^POST .*\/claim$/);
    const session = await launchExtensionSession();

    try {
      const popup = await openPopupPage(session);
      const late = handOff(session, receiver);
      await expect
        .poll(() => receiver.requests.some((r) => r.path.endsWith("/claim")))
        .toBe(true);

      const live = await handOff(session, receiver);
      expect(live.response.ok).toBe(true);
      expect((await sendRuntimeMessage(popup, { type: "call.start" })).ok).toBe(
        true,
      );
      const stored = () => popup.evaluate(() => chrome.storage.local.get(null));
      const before = await stored();

      releaseClaim();
      expect((await late).response.ok).toBe(false);
      expect(await stored()).toEqual(before);
      expect(await rows(popup, "calls")).toHaveLength(1);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });

  test("does not call the server for a token that is not a handoff", async () => {
    const receiver = await createReceiver();
    const session = await launchExtensionSession();

    try {
      const { response } = await handOff(session, receiver, "not-a-token");
      expect(response.ok).toBe(false);
      expect(
        receiver.requests.some((request) => request.path.includes("/claim")),
      ).toBe(false);
    } finally {
      await closeExtensionSession(session);
      await receiver.close();
    }
  });
});

import type { CDPSession } from "@playwright/test";

import { serviceWorkerOf, type ExtensionSession } from "./extension-fixture";

/**
 * Playwright lists an offscreen document as no page, so this attaches to its
 * CDP target by hand. `flatten: false` is the only mode a `CDPSession` can
 * drive, because it cannot address a child session by id.
 */
export interface OffscreenDocument {
  evaluate<T>(expression: string): Promise<T>;
}

interface Reply {
  id: number;
  result?: { result: { value: unknown }; exceptionDetails?: { text: string } };
  error?: { message: string };
}

/**
 * Creates the offscreen document before the recorder does, so a test can
 * instrument it first. The recorder then reuses the document.
 */
export async function openOffscreenDocument(
  session: ExtensionSession,
): Promise<OffscreenDocument> {
  const worker = await serviceWorkerOf(session.context);
  await worker.evaluate(() =>
    chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: ["USER_MEDIA" as chrome.offscreen.Reason],
      justification: "integration test instrumentation",
    }),
  );

  const page = await session.context.newPage();
  const cdp: CDPSession = await session.context.newCDPSession(page);
  const { targetInfos } = await cdp.send("Target.getTargets");
  const target = targetInfos.find((info) =>
    info.url.endsWith("/offscreen.html"),
  );
  if (!target) {
    throw new Error("the offscreen document has no CDP target");
  }
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: false,
  });

  const pending = new Map<number, (reply: Reply) => void>();
  let lastId = 0;
  cdp.on("Target.receivedMessageFromTarget", ({ message }) => {
    const reply: Reply = JSON.parse(message);
    pending.get(reply.id)?.(reply);
  });

  return {
    async evaluate<T>(expression: string): Promise<T> {
      const id = ++lastId;
      const answered = new Promise<Reply>((resolve) =>
        pending.set(id, resolve),
      );
      await cdp.send("Target.sendMessageToTarget", {
        sessionId,
        message: JSON.stringify({
          id,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      });
      const reply = await answered;
      pending.delete(id);
      if (reply.error || reply.result?.exceptionDetails) {
        throw new Error(
          reply.error?.message ?? reply.result?.exceptionDetails?.text,
        );
      }
      return reply.result?.result.value as T;
    },
  };
}

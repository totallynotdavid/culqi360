import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  chromium,
  type BrowserContext,
  type CDPSession,
  type Page,
  type Worker,
} from "@playwright/test";

import type {
  RuntimeMessage,
  RuntimeResponse,
} from "../../../src/domain/messages";
import type { Receiver } from "./receiver";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * The test build swaps only the tab-capture seam (`src/services/tab-capture`)
 * for a fake microphone, because a headless run cannot grant the activeTab
 * invocation that `chrome.tabCapture.getMediaStreamId` needs. Everything else
 * is the production code.
 */
export const TEST_EXTENSION_PATH = path.resolve(
  currentDirectory,
  "../../../.output/chrome-mv3-test",
);

export const DATABASE_NAME = "crm_extension";

export interface ExtensionSession {
  context: BrowserContext;
  extensionId: string;
  userDataDir: string;
  /** Set by `grantMicrophone`. Detaching it takes the grant back. */
  permissions?: CDPSession;
}

/**
 * No `--use-fake-ui-for-media-stream`: it breaks tab-capture `getUserMedia`
 * (`NotFoundError`), and it hides the missing-grant path. The microphone grant
 * is given to the extension origin instead, as one Allow click would.
 */
function extensionArgs(extensionOutputPath: string): string[] {
  return [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    `--disable-extensions-except=${extensionOutputPath}`,
    `--load-extension=${extensionOutputPath}`,
  ];
}

/**
 * Playwright's `grantPermissions` refuses a `chrome-extension://` origin, so
 * this speaks CDP. Chrome drops a CDP grant when the session that made it
 * detaches (measured), so the session and its blank page stay open until
 * `closeExtensionSession`.
 */
export async function grantMicrophone(
  session: ExtensionSession,
): Promise<void> {
  const page = await session.context.newPage();
  const permissions = await session.context.newCDPSession(page);
  await permissions.send("Browser.grantPermissions", {
    origin: `chrome-extension://${session.extensionId}`,
    permissions: ["audioCapture"],
  });
  session.permissions = permissions;
}

/**
 * Chrome ends every live microphone track when its permission is reset, which
 * is the mid-call loss the recorder must survive.
 */
export async function revokeMicrophone(
  session: ExtensionSession,
): Promise<void> {
  if (!session.permissions) {
    throw new Error("the microphone was never granted in this session");
  }
  await session.permissions.send("Browser.resetPermissions");
}

/**
 * Presses the extension's `start-recording` shortcut (Alt+Shift+K) with `page`
 * as the active tab. Chrome treats a key event sent to a page target as a
 * browser accelerator, so `commands.onCommand` fires as it does for a real
 * keystroke.
 */
export async function pressRecordingShortcut(
  session: ExtensionSession,
  page: Page,
): Promise<void> {
  await page.bringToFront();
  const cdp = await session.context.newCDPSession(page);
  try {
    for (const type of ["rawKeyDown", "keyUp"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- key down must precede key up
      await cdp.send("Input.dispatchKeyEvent", {
        type,
        modifiers: 9,
        key: "K",
        code: "KeyK",
        windowsVirtualKeyCode: 75,
        nativeVirtualKeyCode: 75,
      });
    }
  } finally {
    await cdp.detach();
  }
}

export async function serviceWorkerOf(
  context: BrowserContext,
): Promise<Worker> {
  return (
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
  );
}

/** A session whose extension origin holds the microphone grant. */
export async function launchExtensionSession(
  input: { userDataDir?: string } = {},
): Promise<ExtensionSession> {
  const session = await launchUngrantedSession(input);
  await grantMicrophone(session);
  return session;
}

/** A session that never clicked Allow, like a fresh install. */
export async function launchUngrantedSession(
  input: { userDataDir?: string } = {},
): Promise<ExtensionSession> {
  const userDataDir =
    input.userDataDir ??
    (await mkdtemp(path.join(os.tmpdir(), "crm-extension-e2e-")));

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: extensionArgs(TEST_EXTENSION_PATH),
  });

  const serviceWorker = await serviceWorkerOf(context);
  return {
    context,
    extensionId: new URL(serviceWorker.url()).hostname,
    userDataDir,
  };
}

export async function openPopupPage(session: ExtensionSession): Promise<Page> {
  const page = await session.context.newPage();
  await page.goto(`chrome-extension://${session.extensionId}/popup.html`);
  await page.waitForLoadState("domcontentloaded");
  return page;
}

export async function sendRuntimeMessage(
  page: Page,
  message: RuntimeMessage,
): Promise<RuntimeResponse> {
  return page.evaluate(async (payload) => {
    return chrome.runtime.sendMessage(payload);
  }, message);
}

export async function stateOf(page: Page) {
  const response = await sendRuntimeMessage(page, { type: "state.get" });
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.state;
}

/**
 * Hands an assignment to the extension the way the web app does: a page on the
 * web origin sends `assignment.handoff` over `externally_connectable`.
 */
export async function handOff(
  session: ExtensionSession,
  receiver: Receiver,
  token = receiver.issueHandoff(),
): Promise<{ response: RuntimeResponse; token: string }> {
  const webPage = await session.context.newPage();
  try {
    await webPage.goto(`${receiver.origin}/`);
    const response = await webPage.evaluate(
      ({ extensionId, handoffToken }) =>
        chrome.runtime.sendMessage(extensionId, {
          type: "assignment.handoff",
          token: handoffToken,
        }),
      { extensionId: session.extensionId, handoffToken: token },
    );
    return { response, token };
  } finally {
    await webPage.close();
  }
}

export interface DatabaseDump {
  stores: Record<string, Record<string, unknown>[]>;
}

/** Reads every store of the extension database. It reports blobs by size. */
export async function dumpDatabase(page: Page): Promise<DatabaseDump | null> {
  return page.evaluate(async (name) => {
    const known = await indexedDB.databases();
    if (!known.some((database) => database.name === name)) {
      return null;
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stores: Record<string, Record<string, unknown>[]> = {};
    for (const storeName of Array.from(database.objectStoreNames)) {
      const rows = await new Promise<Record<string, unknown>[]>(
        (resolve, reject) => {
          const request = database
            .transaction(storeName)
            .objectStore(storeName)
            .getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        },
      );
      stores[storeName] = rows.map((row) => {
        const { blob, ...rest } = row;
        return blob instanceof Blob
          ? { ...rest, blobSize: blob.size, blobType: blob.type }
          : rest;
      });
    }
    database.close();
    return { stores };
  }, DATABASE_NAME);
}

export async function closeExtensionSession(
  session: ExtensionSession,
  options?: { cleanupUserDataDir?: boolean },
): Promise<void> {
  await session.context.close();

  if (options?.cleanupUserDataDir !== false) {
    await rm(session.userDataDir, { recursive: true, force: true });
  }
}

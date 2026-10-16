import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  chromium,
  type BrowserContext,
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
}

function extensionArgs(extensionOutputPath: string): string[] {
  return [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--disable-extensions-except=${extensionOutputPath}`,
    `--load-extension=${extensionOutputPath}`,
  ];
}

export async function serviceWorkerOf(
  context: BrowserContext,
): Promise<Worker> {
  return (
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
  );
}

export async function launchExtensionSession(
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

/** Reads every store of the extension database; blobs become their size. */
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  focusExtensionWindow,
  handoffLeadToExtension,
} from "~/features/extension/runtime";

describe("extension runtime bridge", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CRM_EXTENSION_ID", "ext-test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(globalThis, "chrome");
  });

  it("keeps executive state on domain failures when the extension returns it", async () => {
    Object.assign(globalThis, {
      chrome: {
        runtime: {
          lastError: undefined,
          sendMessage: (
            _extensionId: string,
            _message: unknown,
            callback: (response?: unknown) => void,
          ) => {
            callback({
              ok: false,
              error: "cannot replace handoff during an active call",
              executiveState: {
                presenceStatus: "active",
                syncHealth: "ok",
                assignmentId: "0199d3a0-0000-7000-8000-000000000042",
                contactId: "0199d3a0-0000-7000-8000-000000000007",
                phone: "999999111",
                presenceUpdatedAt: 1_000,
                syncUpdatedAt: 1_000,
              },
            });
          },
        },
      },
    });

    const result = await handoffLeadToExtension({ token: "handoff-token" });

    expect(result).toMatchObject({
      status: "refused",
      reason: "cannot replace handoff during an active call",
    });
    expect(result.status === "refused" && result.executiveState).toMatchObject({
      presenceStatus: "active",
      assignmentId: "0199d3a0-0000-7000-8000-000000000042",
    });
  });

  it("reports an unreachable extension when the runtime call fails", async () => {
    const runtime = {
      lastError: { message: "Could not establish connection." },
      sendMessage: (
        _extensionId: string,
        _message: unknown,
        callback: (response?: unknown) => void,
      ) => callback(undefined),
    };
    Object.assign(globalThis, { chrome: { runtime } });

    const result = await handoffLeadToExtension({ token: "handoff-token" });

    expect(result).toEqual({
      status: "unreachable",
      reason: "Could not establish connection.",
    });
  });

  it("reports an unreachable extension when the runtime throws while sending", async () => {
    const runtime = {
      lastError: undefined,
      sendMessage: () => {
        throw new TypeError("Invalid extension id");
      },
    };
    Object.assign(globalThis, { chrome: { runtime } });

    const result = await handoffLeadToExtension({ token: "handoff-token" });

    expect(result).toEqual({
      status: "unreachable",
      reason: "Invalid extension id",
    });
  });

  it("does not throw when focusing the extension window fails", () => {
    const runtime = {
      sendMessage: () => {
        throw new TypeError("Invalid extension id");
      },
    };
    Object.assign(globalThis, { chrome: { runtime } });

    expect(() => focusExtensionWindow()).not.toThrow();
  });

  it("reports an unreachable extension when the page has no extension runtime", async () => {
    const result = await handoffLeadToExtension({ token: "handoff-token" });

    expect(result.status).toBe("unreachable");
  });
});

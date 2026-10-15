import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handoffLeadToExtension } from "~/features/extension/runtime";

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

    expect(result).toMatchObject({ ok: false });
    expect(result.executiveState?.presenceStatus).toBe("active");
    expect(result.executiveState?.assignmentId).toBe(
      "0199d3a0-0000-7000-8000-000000000042",
    );
  });
});

import { describe, expect, test } from "vitest";

import { hashAuthKey } from "~/server/auth/password/key-hash";
import { buildThrottleKeys } from "~/server/auth/password/throttle-keys";

describe("auth login component benchmark", () => {
  test("component path: build throttle keys", async ({ bench }) => {
    const result = await bench("component path: build throttle keys", () => {
      const keys = buildThrottleKeys(
        "password_login",
        "exec1@test.local",
        "198.51.100.44",
      );

      if (keys.account.length !== 64 || keys.ip.length !== 64) {
        throw new Error("expected sha256-sized throttle keys");
      }
    }).run();
    expect(result.state).toBe("completed");
  });

  test("component path: hash auth key", async ({ bench }) => {
    const result = await bench("component path: hash auth key", () => {
      const hash = hashAuthKey("ip:password_login:198.51.100.44");
      if (hash.length !== 64) {
        throw new Error(`expected hash length 64, got ${hash.length}`);
      }
    }).run();
    expect(result.state).toBe("completed");
  });
});

import { describe, expect, it } from "vitest";

import {
  generateSessionToken,
  hashSessionToken,
  isValidTokenFormat,
} from "~/server/auth/session/tokens";

describe("session tokens", () => {
  it("generates valid token format", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[a-z2-7]{32}$/);
    expect(isValidTokenFormat(token)).toBe(true);
  });

  it("rejects malformed token formats", () => {
    expect(isValidTokenFormat("short")).toBe(false);
    expect(isValidTokenFormat("A".repeat(32))).toBe(false);
    expect(isValidTokenFormat(`${"a".repeat(31)}!`)).toBe(false);
  });

  it("hash is deterministic and non-reversible in shape", () => {
    const token = "a234567a234567a234567a234567a23";
    const hash1 = hashSessionToken(token);
    const hash2 = hashSessionToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).not.toContain(token);
    expect(hash1).toBe(
      "20d053ea3932fc0f863a19fd77994b9b371fdd18b841aefee1ec4e844a4c9b90",
    );
  });
});

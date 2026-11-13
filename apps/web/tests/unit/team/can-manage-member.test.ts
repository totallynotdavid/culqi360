import { describe, expect, it } from "vitest";

import { canManageMember } from "~/domain/auth/access/member-management";

describe("canManageMember", () => {
  it.each([
    {
      name: "hr reads the team but cannot manage an executive",
      actor: "hr" as const,
      target: "executive" as const,
      expected: false,
    },
    {
      name: "admin manages an executive",
      actor: "admin" as const,
      target: "executive" as const,
      expected: true,
    },
  ])("$name", ({ actor, target, expected }) => {
    expect(canManageMember(actor, target)).toBe(expected);
  });
});

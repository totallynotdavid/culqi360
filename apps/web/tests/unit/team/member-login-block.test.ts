import { describe, expect, it } from "vitest";

import { parseCalendarDate } from "~/domain/time/calendar-date";
import { memberLoginBlock } from "~/features/team-management/member-login-block";

const day = (value: string) => {
  const parsed = parseCalendarDate(value);
  if (!parsed) {
    throw new Error(`bad test date ${value}`);
  }
  return parsed;
};

const TODAY = day("2026-11-15");

describe("memberLoginBlock", () => {
  it.each([
    {
      name: "inactive and expired returns expired",
      detail: { isActive: false, expiresOn: day("2026-11-01") },
      expected: "expired",
    },
    {
      name: "active and expired returns expired",
      detail: { isActive: true, expiresOn: day("2026-11-01") },
      expected: "expired",
    },
    {
      name: "inactive with future expiry returns inactive",
      detail: { isActive: false, expiresOn: day("2026-12-31") },
      expected: "inactive",
    },
    {
      name: "active with no expiry returns null",
      detail: { isActive: true, expiresOn: null },
      expected: null,
    },
  ])("$name", ({ detail, expected }) => {
    expect(memberLoginBlock(detail, TODAY)).toBe(expected);
  });
});

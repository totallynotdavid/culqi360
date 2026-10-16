import { describe, expect, it } from "vitest";

import { resolveWebauthnRelyingParty } from "~/server/auth/factors/passkey-provider";

describe("passkey relying party resolution", () => {
  it.each([
    [
      "https://5173-firebase-crm-1772279181549.cluster-zhw3w37rxzgkutusbbhib6qhra.cloudworkstations.dev",
      "5173-firebase-crm-1772279181549.cluster-zhw3w37rxzgkutusbbhib6qhra.cloudworkstations.dev",
    ],
    ["http://localhost:5173", "localhost"],
  ])("uses the host of %s as rpID without the port", (origin, rpID) => {
    expect(resolveWebauthnRelyingParty(origin)).toEqual({ origin, rpID });
  });
});

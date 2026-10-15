import {
  isBridgeResponse,
  isExecutiveStateSnapshot,
  isExternalRuntimeMessage,
} from "@crm/contracts/extension";
import { describe, expect, it } from "vitest";

describe("extension contract", () => {
  it("accepts a valid executive state", () => {
    expect(
      isExecutiveStateSnapshot({
        presenceStatus: "active",
        syncHealth: "ok",
        assignmentId: "0199d3a0-0000-7000-8000-000000000042",
        contactId: "0199d3a0-0000-7000-8000-000000000007",
        phone: "999999111",
        presenceUpdatedAt: 1_000,
        syncUpdatedAt: 2_000,
      }),
    ).toBe(true);
  });

  it("rejects unknown status values", () => {
    expect(
      isExecutiveStateSnapshot({
        presenceStatus: "busy",
        syncHealth: "ok",
        assignmentId: null,
        contactId: null,
        phone: null,
        presenceUpdatedAt: null,
        syncUpdatedAt: null,
      }),
    ).toBe(false);

    expect(
      isExecutiveStateSnapshot({
        presenceStatus: "idle",
        syncHealth: "broken",
        assignmentId: null,
        contactId: null,
        phone: null,
        presenceUpdatedAt: null,
        syncUpdatedAt: null,
      }),
    ).toBe(false);
  });

  it("validates external bridge messages", () => {
    expect(isExternalRuntimeMessage({ type: "state.get" })).toBe(true);
    expect(
      isExternalRuntimeMessage({
        type: "assignment.handoff",
        token: "signed-token",
      }),
    ).toBe(true);
    expect(
      isExternalRuntimeMessage({ type: "assignment.handoff", token: 1 }),
    ).toBe(false);
  });

  it("validates bridge responses", () => {
    expect(
      isBridgeResponse({
        ok: true,
        executiveState: {
          presenceStatus: "ready",
          syncHealth: "pending",
          assignmentId: "0199d3a0-0000-7000-8000-000000000001",
          contactId: "0199d3a0-0000-7000-8000-000000000002",
          phone: "999999111",
          presenceUpdatedAt: 10,
          syncUpdatedAt: 20,
        },
      }),
    ).toBe(true);

    expect(
      isBridgeResponse({
        ok: false,
        error: "failed",
        executiveState: {
          presenceStatus: "idle",
          syncHealth: "reauth_required",
          assignmentId: null,
          contactId: null,
          phone: null,
          presenceUpdatedAt: null,
          syncUpdatedAt: null,
        },
      }),
    ).toBe(true);

    expect(isBridgeResponse({ ok: false, error: 1 })).toBe(false);
  });
});

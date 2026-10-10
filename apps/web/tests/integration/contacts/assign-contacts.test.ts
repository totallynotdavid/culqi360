import { operationAt } from "@tests/support/operation";
import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  TEST_FIXTURES,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { RecordCandidate } from "~/contracts/engine/record-api.generated";
import { external, type DomainError } from "~/domain/errors";
import { appCalendarDateAt, appDayRange } from "~/domain/time/app-time";
import { createContactAssignmentsRuntime } from "~/server/contact-assignments/runtime";
import type { EngineClient } from "~/server/integrations/engine/client";
import { Err, Ok, type Result } from "~/shared/result";

const ACTOR_ID = TEST_FIXTURES.users.execOne.id;
const BRANCH_ID = TEST_FIXTURES.branches.lima.id;
const BUFFER_TARGET = 10;

const NOW = new Date("2026-08-07T17:00:00.000Z");
const DAY_RANGE = appDayRange(appCalendarDateAt(NOW));

function makeCandidate(seed: number): RecordCandidate {
  const n = String(seed).padStart(3, "0");

  return {
    ruc: `20${n}000000`,
    organization_name: `Org ${n}`,
    dni: `70${n}000`,
    person_name: `Person ${n}`,
    phone_primary: `+51999${n}000`,
  };
}

function engineReturning(
  candidates: RecordCandidate[],
): Pick<EngineClient, "requestCandidates"> {
  return {
    requestCandidates: async () => Ok(candidates),
  };
}

function engineFailing(): Pick<EngineClient, "requestCandidates"> {
  return {
    requestCandidates: async (): Promise<
      Result<RecordCandidate[], DomainError>
    > =>
      Err(
        external("service unavailable", {
          code: "engine_request_failed",
          details: {
            status: 503,
            request_id: "req-leads-1",
            engine_error: "service unavailable",
          },
        }),
      ),
  };
}

function engineThrowing(
  message: string,
): Pick<EngineClient, "requestCandidates"> {
  return {
    requestCandidates: async () => {
      throw new Error(message);
    },
  };
}

describe("assignContacts", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestDb("assign-contacts");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  async function runAssign(engine: Pick<EngineClient, "requestCandidates">) {
    const runtime = createContactAssignmentsRuntime({
      executor: ctx.db,
      engine,
    });

    return runtime.assign(
      {
        actorUserId: ACTOR_ID,
        branchId: BRANCH_ID,
      },
      operationAt(NOW),
    );
  }

  it("stops requesting candidates once the buffer is full", async () => {
    const candidates = Array.from({ length: BUFFER_TARGET }, (_, i) =>
      makeCandidate(i + 1),
    );

    const fill = await runAssign(engineReturning(candidates));

    expect(fill.ok).toBe(true);
    if (!fill.ok) {
      throw new Error("expected success");
    }

    expect(fill.value).toEqual({
      requested: BUFFER_TARGET,
      assigned: BUFFER_TARGET,
    });

    let engineCalled = false;

    const result = await runAssign({
      requestCandidates: async () => {
        engineCalled = true;
        return Ok([]);
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.value).toEqual({ requested: 0, assigned: 0 });
    expect(engineCalled).toBe(false);

    const reservations =
      await ctx.repos.leadUsageReservations.findByUserAndRange(
        ACTOR_ID,
        DAY_RANGE,
      );

    expect(reservations).toHaveLength(1);
  });

  it("skips a candidate on cooldown and only commits the assigned amount", async () => {
    const onCooldown = makeCandidate(1);

    const organization = await ctx.repos.organization.upsertOrganization({
      ruc: onCooldown.ruc,
      legalName: onCooldown.organization_name,
      upsertedAt: NOW,
    });

    const membership = await ctx.repos.organization.upsertMembership({
      organizationId: organization.id,
      person: {
        dni: onCooldown.dni,
        names: onCooldown.person_name,
        firstSurname: null,
        secondSurname: null,
        email: null,
      },
      phone: onCooldown.phone_primary,
      email: null,
      upsertedAt: NOW,
    });

    await ctx.repos.cadence.touch({
      organizationPersonId: membership.id,
      userId: ACTOR_ID,
      contactedAt: NOW,
      cooldownUntil: new Date(NOW.getTime() + 60 * 60 * 1000),
    });

    const candidates = [onCooldown, makeCandidate(2), makeCandidate(3)];
    const result = await runAssign(engineReturning(candidates));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    // `requested` is the buffer shortfall, not the number of candidates returned.
    expect(result.value).toEqual({ requested: BUFFER_TARGET, assigned: 2 });

    const activeCount = await ctx.repos.contactAssignments.countActiveByUser(
      ACTOR_ID,
      NOW,
    );

    expect(activeCount).toBe(2);

    const [reservations, commits] = await Promise.all([
      ctx.repos.leadUsageReservations.findByUserAndRange(ACTOR_ID, DAY_RANGE),
      ctx.repos.leadUsageCommits.findByUserAndRange(ACTOR_ID, DAY_RANGE),
    ]);

    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({
      amount: 2,
      status: "committed",
    });

    expect(commits).toHaveLength(1);
    expect(commits[0]?.amount).toBe(2);
  });

  it("commits the full amount when every candidate is assigned", async () => {
    const result = await runAssign(engineReturning([makeCandidate(1)]));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.value).toEqual({
      requested: BUFFER_TARGET,
      assigned: 1,
    });

    const reservations =
      await ctx.repos.leadUsageReservations.findByUserAndRange(
        ACTOR_ID,
        DAY_RANGE,
      );

    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({
      amount: 1,
      status: "committed",
    });
  });

  it("cancels the reservation when the engine reports an error", async () => {
    const result = await runAssign(engineFailing());

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }

    expect(result.error.details).toMatchObject({
      status: 503,
      request_id: "req-leads-1",
    });

    const reservations =
      await ctx.repos.leadUsageReservations.findByUserAndRange(
        ACTOR_ID,
        DAY_RANGE,
      );

    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.status).toBe("cancelled");
  });

  it("cancels the reservation and rethrows when a downstream step throws", async () => {
    await expect(
      runAssign(engineThrowing("engine connection lost")),
    ).rejects.toThrow("engine connection lost");

    const reservations =
      await ctx.repos.leadUsageReservations.findByUserAndRange(
        ACTOR_ID,
        DAY_RANGE,
      );

    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.status).toBe("cancelled");
  });
});

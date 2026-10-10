import { operationAt } from "@tests/support/operation";
import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  TEST_FIXTURES,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SearchResult } from "~/contracts/search/engine-results.generated";
import { external, type DomainError } from "~/domain/errors";
import { appMonthRange } from "~/domain/time/app-time";
import { CAPACITY_LIMITS } from "~/server/capacity/domain/config";
import type { EngineClient } from "~/server/integrations/engine/client";
import { runDirectSearch } from "~/server/search-workflow/run-search";
import { createSearchUsageReservationPorts } from "~/server/search/infrastructure/search-usage-reservation-ports";
import { Err, Ok, type Result } from "~/shared/result";

const ACTOR_ID = TEST_FIXTURES.users.execOne.id;
const MONTHLY_LIMIT = CAPACITY_LIMITS.defaultSearchMonthly;

const foundResult: SearchResult = {
  kind: "document",
  doc: {
    doc_type: "DNI",
    doc_number: "12345678",
    name: "Test Person",
    ruc: null,
    birth_date: null,
    birth_place: null,
    sex: null,
    marital_status: null,
    location_text: null,
    ubigeo_code: null,
    mother_name: null,
    father_name: null,
    email: null,
  },
  org: null,
  role: null,
  phones: { primary: null, secondary: null, siblings: null },
};

function engineReturning(
  results: SearchResult[],
): Pick<EngineClient, "search"> {
  return { search: async () => Ok(results) };
}

function engineFailing(): Pick<EngineClient, "search"> {
  return {
    search: async (): Promise<Result<SearchResult[], DomainError>> =>
      Err(
        external("service unavailable", {
          code: "engine_request_failed",
          details: {
            status: 503,
            request_id: "req-search-1",
            engine_error: "service unavailable",
          },
        }),
      ),
  };
}

describe("runDirectSearch", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestDb("run-direct-search");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  function ports() {
    return createSearchUsageReservationPorts(ctx.db);
  }

  it("commits the reservation when the engine returns a result", async () => {
    const result = await runDirectSearch(
      {
        actorUserId: ACTOR_ID,
        intent: "people",
        query: "12345678",
        limit: 10,
      },
      ports(),
      engineReturning([foundResult]),
      operationAt(new Date()),
    );

    expect(result.ok).toBe(true);

    const range = appMonthRange(new Date());
    const [reservations, commits] = await Promise.all([
      ctx.repos.searchUsageReservations.findByUserAndRange(ACTOR_ID, range),
      ctx.repos.searchUsageCommits.findByUserAndRange(ACTOR_ID, range),
    ]);
    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({ amount: 1, status: "committed" });
    expect(commits).toHaveLength(1);
  });

  it("cancels the reservation when the engine reports an error", async () => {
    const result = await runDirectSearch(
      {
        actorUserId: ACTOR_ID,
        intent: "people",
        query: "12345678",
        limit: 10,
      },
      ports(),
      engineFailing(),
      operationAt(new Date()),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.error.details).toMatchObject({
      status: 503,
      request_id: "req-search-1",
    });

    const range = appMonthRange(new Date());
    const reservations =
      await ctx.repos.searchUsageReservations.findByUserAndRange(
        ACTOR_ID,
        range,
      );
    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.status).toBe("cancelled");
  });

  it("returns exhausted immediately without calling the engine once the monthly limit is committed", async () => {
    const now = new Date();
    const reservation = await ctx.repos.searchUsageReservations.insert({
      user_id: ACTOR_ID,
      amount: MONTHLY_LIMIT,
      reason: "direct_search",
      created_at: now,
      updated_at: now,
    });
    await ctx.repos.searchUsageCommits.insert({
      reservation_id: reservation.id,
      amount: MONTHLY_LIMIT,
      created_at: now,
    });
    await ctx.repos.searchUsageReservations.updateAmountAndStatus(
      reservation.id,
      MONTHLY_LIMIT,
      "committed",
      now,
    );

    let engineCalled = false;
    const result = await runDirectSearch(
      {
        actorUserId: ACTOR_ID,
        intent: "people",
        query: "12345678",
        limit: 10,
      },
      ports(),
      {
        search: async () => {
          engineCalled = true;
          return Ok([]);
        },
      },
      operationAt(new Date()),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.error.code).toBe("search_exhausted");
    expect(engineCalled).toBe(false);
  });
});

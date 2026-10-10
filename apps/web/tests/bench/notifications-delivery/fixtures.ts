import type { TestDbContext } from "@tests/support/runtime/db";
import { TEST_FIXTURES } from "@tests/support/runtime/db";
import { randomUUIDv7 } from "bun";

import type { Json } from "~/contracts/json";
import { BranchId, NotificationIntentId, UserId } from "~/domain/ids";
import { enqueueNotifications } from "~/server/notifications/intent/enqueue";
import {
  createDeliveryRepository,
  type DeliveryJob,
} from "~/server/notifications/repos/delivery-repo";
import type { IntentJob } from "~/server/notifications/repos/intent-repo";
import type { NotificationIntent } from "~/server/notifications/types";

import { BENCH_NOW, benchDate } from "../_shared/constants";

const BRANCH_ID = BranchId.trust(TEST_FIXTURES.branches.lima.id);

export const PLANNER_SCENARIOS = [
  {
    name: "disjoint",
    intentCount: 12,
    recipientsPerIntent: 24,
    overlapRatio: 0,
  },
  {
    name: "partial-overlap",
    intentCount: 12,
    recipientsPerIntent: 24,
    overlapRatio: 0.5,
  },
  {
    name: "high-overlap",
    intentCount: 12,
    recipientsPerIntent: 24,
    overlapRatio: 0.85,
  },
] as const;

export const EXPAND_RECIPIENTS = 12;

export type PlannerScenarioName = (typeof PLANNER_SCENARIOS)[number]["name"];

export interface PlannerEntry {
  event_type: string;
  audience_json: Json;
  channels_json: Json;
}

type PlannerScenario = (typeof PLANNER_SCENARIOS)[number];
type PlannerScenarioResult<T> = Record<PlannerScenarioName, T>;

function createUserIds(count: number): UserId[] {
  return Array.from({ length: count }, () => UserId.trust(randomUUIDv7()));
}

async function seedUsersAndAddresses(
  ctx: TestDbContext,
  userIds: UserId[],
  seedKey: string,
): Promise<void> {
  await ctx.db
    .insertInto("users")
    .values(
      userIds.map((userId, index) => ({
        id: userId,
        branch_id: BRANCH_ID,
        team_id: null,
        username: `bench.notify.${seedKey}.${index}`,
        email: `bench-${seedKey}-${index}@test.local`,
        password_hash: "bench-hash",
        names: `Bench Notify ${seedKey} ${index}`,
        first_surname: "User",
        second_surname: "Bench",
        onboarding_completed_at: BENCH_NOW,
        role: "executive" as const,
        executive_category: "elite" as const,
        is_active: true,
        created_at: BENCH_NOW,
      })),
    )
    .execute();

  await ctx.db
    .insertInto("user_channel_addresses")
    .values(
      userIds.flatMap((userId, index) => [
        {
          user_id: userId,
          channel: "email" as const,
          address: `bench-${seedKey}-${index}@test.local`,
          is_verified: true,
          verified_at: BENCH_NOW,
          created_at: BENCH_NOW,
          updated_at: BENCH_NOW,
        },
        {
          user_id: userId,
          channel: "whatsapp" as const,
          address: `9${userId}`,
          is_verified: true,
          verified_at: BENCH_NOW,
          created_at: BENCH_NOW,
          updated_at: BENCH_NOW,
        },
      ]),
    )
    .execute();

  await ctx.db
    .insertInto("whatsapp_sessions")
    .values(
      userIds.map((userId) => ({
        user_id: userId,
        expires_at: benchDate(24 * 60 * 60 * 1000),
      })),
    )
    .execute();
}

function createAudiencePool(
  userIds: UserId[],
  recipientsPerIntent: number,
  overlapRatio: number,
  intentCount: number,
): UserId[][] {
  const stride = Math.max(
    1,
    Math.round(recipientsPerIntent * (1 - overlapRatio)),
  );

  return Array.from({ length: intentCount }, (_outerIndex, intentIndex) => {
    const start = intentIndex * stride;
    return Array.from(
      { length: recipientsPerIntent },
      (_innerIndex, recipientIndex) => {
        const userId = userIds[(start + recipientIndex) % userIds.length];
        if (!userId) {
          throw new Error("Audience pool needs at least one user");
        }
        return userId;
      },
    );
  });
}

async function seedPlannerScenario(
  ctx: TestDbContext,
  scenario: PlannerScenario,
): Promise<NotificationIntentId> {
  const stride = Math.max(
    1,
    Math.round(scenario.recipientsPerIntent * (1 - scenario.overlapRatio)),
  );
  const totalUsers =
    scenario.recipientsPerIntent + stride * (scenario.intentCount - 1);
  const userIds = createUserIds(totalUsers);

  await seedUsersAndAddresses(ctx, userIds, `planner-${scenario.name}`);

  const audiences = createAudiencePool(
    userIds,
    scenario.recipientsPerIntent,
    scenario.overlapRatio,
    scenario.intentCount,
  );

  const intents: NotificationIntent[] = audiences.map(
    (audienceUserIds, index) => ({
      id: NotificationIntentId.trust(`bench:planner:${scenario.name}:${index}`),
      eventType: "lead.ready_for_quotation",
      audience: { kind: "user_ids", userIds: audienceUserIds },
      channels: ["email", "whatsapp"],
      priority: "normal",
      title: `Bench planner ${scenario.name} ${index}`,
      bodyText: "Bench planner body",
      actionUrl: null,
    }),
  );

  await enqueueNotifications(ctx.db, intents, BENCH_NOW);
  return NotificationIntentId.trust(`bench:planner:${scenario.name}:0`);
}

async function loadPlannerEntry(
  ctx: TestDbContext,
  intentId: NotificationIntentId,
): Promise<PlannerEntry> {
  const entry = await ctx.db
    .selectFrom("notification_intents")
    .select(["event_type", "audience_json", "channels_json"])
    .where("id", "=", intentId)
    .executeTakeFirst();
  if (!entry) {
    throw new Error(`planner intent ${intentId} not seeded`);
  }
  return entry;
}

export async function seedPlannerEntries(
  ctx: TestDbContext,
): Promise<PlannerScenarioResult<PlannerEntry>> {
  const [disjoint, partialOverlap, highOverlap] = PLANNER_SCENARIOS;

  const [disjointId, partialOverlapId, highOverlapId] = await Promise.all([
    seedPlannerScenario(ctx, disjoint),
    seedPlannerScenario(ctx, partialOverlap),
    seedPlannerScenario(ctx, highOverlap),
  ]);

  const [disjointEntry, partialOverlapEntry, highOverlapEntry] =
    await Promise.all([
      loadPlannerEntry(ctx, disjointId),
      loadPlannerEntry(ctx, partialOverlapId),
      loadPlannerEntry(ctx, highOverlapId),
    ]);

  return {
    disjoint: disjointEntry,
    "partial-overlap": partialOverlapEntry,
    "high-overlap": highOverlapEntry,
  };
}

export async function seedExpandRecipients(
  ctx: TestDbContext,
): Promise<UserId[]> {
  const userIds = createUserIds(EXPAND_RECIPIENTS);
  await seedUsersAndAddresses(ctx, userIds, "expand");
  return userIds;
}

export async function seedExpandIntent(
  ctx: TestDbContext,
  userIds: UserId[],
): Promise<IntentJob> {
  const id = NotificationIntentId.trust(`bench:expand:${randomUUIDv7()}`);
  const intent: NotificationIntent = {
    id,
    eventType: "lead.ready_for_quotation",
    audience: { kind: "user_ids", userIds },
    channels: ["in_app", "email", "whatsapp"],
    priority: "normal",
    title: "Bench expand",
    bodyText: "Bench expand body",
    actionUrl: null,
  };
  await enqueueNotifications(ctx.db, [intent], BENCH_NOW);

  const job = await ctx.db
    .selectFrom("notification_intents")
    .select([
      "id",
      "attempt_count",
      "max_attempts",
      "event_type",
      "audience_json",
      "channels_json",
      "priority",
      "title",
      "body_text",
      "action_url",
    ])
    .where("id", "=", NotificationIntentId.trust(id))
    .executeTakeFirst();
  if (!job) {
    throw new Error(`expand intent ${id} not seeded`);
  }
  return job;
}

export async function seedDispatchRecipient(
  ctx: TestDbContext,
): Promise<UserId> {
  const userId = UserId.trust(randomUUIDv7());
  await seedUsersAndAddresses(ctx, [userId], "dispatch");
  return userId;
}

// A fresh pending delivery to send. send() consumes it (records an attempt,
// marks it sent). A unique intent id keeps the (intent,user,channel) key from
// collapsing rows.
export async function seedDispatchDelivery(
  ctx: TestDbContext,
  userId: UserId,
): Promise<DeliveryJob> {
  const intentId = NotificationIntentId.trust(
    `bench-dispatch-${randomUUIDv7()}`,
  );
  const deliveries = createDeliveryRepository(ctx.db);

  await deliveries.insertPlanned(
    [
      {
        intent_id: intentId,
        user_id: userId,
        channel: "email" as const,
        recipient_address: "bench-dispatch@test.local",
        title: "Bench dispatch",
        body_text: "Bench dispatch body",
        action_url: null,
      },
    ],
    BENCH_NOW,
  );

  const job = await ctx.db
    .selectFrom("notification_deliveries")
    .select([
      "id",
      "attempt_count",
      "max_attempts",
      "intent_id",
      "user_id",
      "channel",
      "recipient_address",
      "title",
      "body_text",
      "action_url",
    ])
    .where("intent_id", "=", intentId)
    .executeTakeFirst();
  if (!job) {
    throw new Error(`dispatch delivery for ${intentId} not seeded`);
  }
  return job;
}

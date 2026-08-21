import {
  jobSubscriptionId,
  parseJobRoute,
  parseJobSubscriptionId,
} from "~/contracts/jobs/job-event";
import { REALTIME_CHANNELS } from "~/contracts/realtime/channel";
import { defineRealtimeChannel } from "~/server/realtime/channel";

import type { JobProjector } from "./projector";

export const JOBS_PG_CHANNEL = "job-progress";

/**
 * The one realtime channel every kind of tracked work streams over.
 *
 * Subscriptions are keyed by `kind:subjectId`, so a single pg channel and a
 * single client primitive cover all of them. Adding a job type is a projector
 * and a producer, not another channel, event shape, and hook.
 */
export function createJobsChannel(
  projectors: readonly JobProjector[],
): ReturnType<typeof defineRealtimeChannel> {
  const byKind = new Map(
    projectors.map((projector) => [projector.kind, projector]),
  );

  return defineRealtimeChannel({
    name: REALTIME_CHANNELS.jobs,
    pgChannel: JOBS_PG_CHANNEL,

    parseId: (raw) => (parseJobSubscriptionId(raw) === null ? null : raw),

    open: async (session, rawSubscriptionId) => {
      const target = parseJobSubscriptionId(rawSubscriptionId);
      const projector = target && byKind.get(target.kind);

      if (!target || !projector) {
        return null;
      }

      const event = await projector.open(session, target.subjectId);

      return event ? [{ data: JSON.stringify(event) }] : null;
    },

    topicIdOfPayload: (payload) => {
      const route = parseJobRoute(payload);

      return route === null
        ? null
        : jobSubscriptionId(route.kind, route.subjectId);
    },
  });
}

import { revalidate } from "@solidjs/router";
import { createMemo, createSignal, type Accessor } from "solid-js";

import {
  isJobSettled,
  jobSubscriptionId,
  parseJobEvent,
  type JobEvent,
  type JobKind,
} from "~/contracts/jobs/job-event";
import { REALTIME_CHANNELS } from "~/contracts/realtime/channel";

import { createTopicConnection } from "../realtime/create-topic-connection";
import { trackRealtimeConnection } from "../realtime/realtime-status";

/**
 * Live state of one tracked job, or undefined until the first frame arrives.
 *
 * The channel answers a new subscription with the job's current state before any
 * update, so this is the whole read: there is no companion query to seed it from
 * and nothing to revalidate on every tick.
 */
export function createJob<Detail>(options: {
  kind: JobKind;
  // Null unsubscribes, which is how a screen with nothing running stays quiet.
  subjectId: Accessor<string | null>;
  parseDetail: (value: unknown) => Detail | null;
}): Accessor<JobEvent<Detail> | undefined> {
  const subscriptionId = createMemo(() => {
    const subjectId = options.subjectId();

    return subjectId === null
      ? null
      : jobSubscriptionId(options.kind, subjectId);
  });

  // Writable memo: a new subject recomputes to undefined, so a view never shows
  // the previous subject's last frame while the new subscription opens.
  const [event, setEvent] = createSignal<JobEvent<Detail> | undefined>(() => {
    subscriptionId();

    return undefined;
  });

  const connection = createTopicConnection({
    channel: REALTIME_CHANNELS.jobs,
    id: subscriptionId,

    // A settled job publishes nothing further, so holding the stream open would
    // only cost a connection and a periodic reauthorization.
    stopped: () => {
      const current = event();

      return current !== undefined && isJobSettled(current);
    },

    onMessage: (message) => {
      const parsed = parseJobEvent(message.data, options.parseDetail);

      if (parsed === null) {
        return;
      }

      setEvent(() => parsed);

      // The single place job completion drops caches. The server decides what
      // went stale, because it is the side that knows.
      if (parsed.stale && parsed.stale.length > 0) {
        revalidate([...parsed.stale]);
      }
    },
  });

  trackRealtimeConnection(connection);

  return event;
}

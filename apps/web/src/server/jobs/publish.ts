import type { JobEvent } from "~/contracts/jobs/job-event";
import type { DatabaseExecutor } from "~/server/platform/database/executor";
import { notify } from "~/server/platform/database/notifications/publish";

import { JOBS_PG_CHANNEL } from "./channel";

/**
 * Broadcasts a job's current state to its subscribers.
 *
 * Called inside the transaction that produced the state, so subscribers cannot
 * observe a notification before the row it describes is visible: postgres
 * releases the notification on commit.
 */
export function publishJobEvent(
  db: DatabaseExecutor,
  event: JobEvent,
): Promise<void> {
  return notify(db, JOBS_PG_CHANNEL, JSON.stringify(event));
}

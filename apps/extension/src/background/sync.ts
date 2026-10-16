import { commit } from "@/src/services/database";
import { flushDue, flushNow, nextDueAt } from "@/src/services/outbox";
import { readSession } from "@/src/services/session";

import { enqueueEvent } from "./calls";

export const HEARTBEAT_ALARM = "crm.sync" as const;
const RETRY_ALARM = "crm.retry" as const;

export function isSyncAlarm(name: string): boolean {
  return name === HEARTBEAT_ALARM || name === RETRY_ALARM;
}

export async function ensureAlarms(): Promise<void> {
  if (await browser.alarms.get(HEARTBEAT_ALARM)) {
    return;
  }
  await browser.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
}

/**
 * Wakes the worker when the earliest backed-off job is due. Without it a
 * retry would wait for the next one-minute alarm. Chrome stretches an alarm of
 * a packed extension to 30 seconds at least.
 */
async function scheduleRetryWake(): Promise<void> {
  const due = await nextDueAt();
  if (due === null) {
    await browser.alarms.clear(RETRY_ALARM);
    return;
  }
  await browser.alarms.create(RETRY_ALARM, { when: due });
}

export async function syncDue(): Promise<void> {
  await flushDue();
  await scheduleRetryWake();
}

export async function syncNow(): Promise<void> {
  await flushNow();
  await scheduleRetryWake();
}

export async function enqueueHeartbeat(): Promise<void> {
  if ((await readSession())?.sessionToken == null) {
    return;
  }

  await commit(async (tx) => {
    const queue = await tx.getAll("queue");
    const waiting = queue.some(
      (row) =>
        row.job.kind === "event" && row.job.type === "executive.heartbeat",
    );
    if (!waiting) {
      await enqueueEvent(tx, "executive.heartbeat", { occurredAt: Date.now() });
    }
  });
}

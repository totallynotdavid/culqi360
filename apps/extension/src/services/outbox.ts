import type { QueueJob, QueueRow, SessionRecord } from "@/src/domain/model";

import { refreshSession } from "./api";
import { backoffMs } from "./backoff";
import { commit, read } from "./database";
import { deliver, type Outcome } from "./deliver";
import { clearCredentials, readSession, writeSession } from "./session";

/**
 * Jobs of one lane go in order and one failure holds the rest of the lane for
 * the pass, so an outage costs one attempt per lane instead of one per job.
 * Events and each recording are separate lanes: a failing upload never delays
 * a call event.
 */
function laneOf(job: QueueJob): string {
  return job.kind === "event" ? "events" : `recording:${job.recordingId}`;
}

/** What `attempt` hands to `settle`: a 401 has been retried or turned into a retry. */
type Settled = Exclude<Outcome, { kind: "unauthorized" }>;

function recordSuccess(): Promise<void> {
  return commit(async (tx) => {
    await tx.setMeta("lastSyncAt", Date.now());
    await tx.setMeta("lastSyncError", null);
  });
}

function recordFailure(
  sequence: number,
  failure: Extract<Settled, { kind: "retry" }>,
): Promise<void> {
  return commit(async (tx) => {
    const row = await tx.get("queue", sequence);
    if (!row) {
      return;
    }

    const attempts = row.attempts + 1;
    await tx.put("queue", {
      ...row,
      attempts,
      nextAttemptAt: Date.now() + backoffMs(attempts),
      lastError: failure.error,
    });
    await tx.setMeta("lastSyncError", failure.error);
  });
}

interface PassState {
  session: SessionRecord;
  refreshed: boolean;
}

/**
 * Handles a 401: rotates the tokens once per pass and sends the row again. A
 * refused refresh signs the agent out and burns no attempt, since the job
 * itself did nothing wrong.
 */
async function recoverSession(
  row: QueueRow,
  pass: PassState,
): Promise<Settled | null> {
  const rejected: Settled = {
    kind: "retry",
    error: "server rejected the refreshed session token",
  };
  if (pass.refreshed) {
    return rejected;
  }
  pass.refreshed = true;

  const refreshed = await refreshSession(pass.session);
  if (refreshed.kind === "failed") {
    await commit((tx) => tx.setMeta("lastSyncError", refreshed.error));
    return null;
  }
  if (refreshed.kind === "refused") {
    await clearCredentials();
    return null;
  }

  await writeSession(refreshed.session);
  pass.session = refreshed.session;
  const outcome = await deliver(row, pass.session);
  return outcome.kind === "unauthorized" ? rejected : outcome;
}

async function attempt(
  row: QueueRow,
  pass: PassState,
): Promise<Settled | null> {
  const outcome = await deliver(row, pass.session);
  return outcome.kind === "unauthorized" ? recoverSession(row, pass) : outcome;
}

interface PassResult {
  progressed: boolean;
}

function isBlockedByBackoff(row: QueueRow, force: boolean): boolean {
  return !force && row.nextAttemptAt > Date.now();
}

async function runPass(force: boolean): Promise<PassResult> {
  const session = await readSession();
  if (!navigator.onLine || session?.sessionToken == null) {
    return { progressed: false };
  }

  const pass: PassState = { session, refreshed: false };
  const held = new Set<string>();
  let progressed = false;
  const queue = await read((tx) => tx.getAll("queue"));

  for (const queued of queue) {
    const lane = laneOf(queued.job);
    if (held.has(lane)) {
      continue;
    }
    if (isBlockedByBackoff(queued, force)) {
      held.add(lane);
      continue;
    }

    // oxlint-disable-next-line no-await-in-loop -- jobs of a lane must go in order
    const row = await read((tx) => tx.get("queue", queued.sequence));
    if (!row) {
      continue;
    }

    // oxlint-disable-next-line no-await-in-loop -- jobs of a lane must go in order
    const outcome = await attempt(row, pass);
    if (outcome === null) {
      break;
    }
    // oxlint-disable-next-line no-await-in-loop -- jobs of a lane must go in order
    progressed = (await settle(row, outcome, held)) || progressed;
  }
  return { progressed };
}

async function settle(
  row: QueueRow,
  outcome: Settled,
  held: Set<string>,
): Promise<boolean> {
  switch (outcome.kind) {
    case "done":
      await recordSuccess();
      return true;
    case "waiting":
      return false;
    case "retry":
      await recordFailure(row.sequence, outcome);
      held.add(laneOf(row.job));
      return false;
    default:
      return outcome satisfies never;
  }
}

let chain: Promise<unknown> = Promise.resolve();
let dueQueued: Promise<void> | null = null;

async function runUntilIdle(force: boolean): Promise<void> {
  // A pass that finished a job may have unblocked another (a close waiting for
  // its segments) or seen new rows arrive, so go again until nothing moves.
  let result = await runPass(force);
  while (result.progressed) {
    // oxlint-disable-next-line no-await-in-loop -- each pass depends on the last
    result = await runPass(force);
  }
}

function enqueuePass(force: boolean): Promise<void> {
  const next = chain.then(() => runUntilIdle(force));
  chain = next.catch(() => undefined);
  return next;
}

export function flushDue(): Promise<void> {
  if (dueQueued) {
    return dueQueued;
  }
  const queued = enqueuePass(false).finally(() => {
    dueQueued = null;
  });
  dueQueued = queued;
  return queued;
}

export function flushNow(): Promise<void> {
  return enqueuePass(true);
}

export async function nextDueAt(): Promise<number | null> {
  const queue = await read((tx) => tx.getAll("queue"));
  const waiting = queue
    .filter((row) => row.nextAttemptAt > Date.now())
    .map((row) => row.nextAttemptAt);
  return waiting.length === 0 ? null : Math.min(...waiting);
}

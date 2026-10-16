import {
  isHeartbeat,
  type QueueJob,
  type QueueRow,
  type SessionRecord,
} from "@/src/domain/model";

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

/** The failure that parks a job whatever the server says. */
const MAX_ATTEMPTS = 20;

/**
 * Counts the failure. A refusal, or the last allowed attempt, parks the job as
 * a dead letter with its error. A parked heartbeat is dropped instead: the next
 * alarm queues a fresh one, and a kept one would stop that. Returns whether the
 * job left the retry schedule.
 */
function recordFailure(
  sequence: number,
  failure: Extract<Settled, { kind: "retry" | "rejected" }>,
): Promise<boolean> {
  return commit(async (tx) => {
    const row = await tx.get("queue", sequence);
    if (!row) {
      return false;
    }

    await tx.setMeta("lastSyncError", failure.error);
    const failed = {
      ...row,
      attempts: row.attempts + 1,
      lastError: failure.error,
    };
    if (failure.kind === "retry" && failed.attempts < MAX_ATTEMPTS) {
      await tx.put("queue", {
        ...failed,
        nextAttemptAt: Date.now() + backoffMs(failed.attempts),
      });
      return false;
    }

    if (isHeartbeat(row.job)) {
      await tx.delete("queue", sequence);
      return true;
    }
    await tx.put("queue", { ...failed, deadAt: Date.now() });
    return true;
  });
}

/**
 * Puts every parked job back on the schedule with a fresh attempt count. Only
 * the agent asks for this: a dead letter stays out of every pass until then.
 */
export function requeueDeadLetters(): Promise<void> {
  return commit(async (tx) => {
    const queue = await tx.getAll("queue");
    const now = Date.now();
    await Promise.all(
      queue
        .filter((row) => row.deadAt != null)
        .map((row) =>
          tx.put("queue", {
            ...row,
            attempts: 0,
            nextAttemptAt: now,
            deadAt: null,
          }),
        ),
    );
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
  const stillUnauthorized: Settled = {
    kind: "retry",
    error: "server rejected the refreshed session token",
  };
  if (pass.refreshed) {
    return stillUnauthorized;
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
  return outcome.kind === "unauthorized" ? stillUnauthorized : outcome;
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
    if (queued.deadAt != null) {
      continue;
    }
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
    case "rejected":
      // A parked job releases its lane, so the jobs behind it still go out.
      if (!(await recordFailure(row.sequence, outcome))) {
        held.add(laneOf(row.job));
      }
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
    .filter((row) => row.deadAt == null && row.nextAttemptAt > Date.now())
    .map((row) => row.nextAttemptAt);
  return waiting.length === 0 ? null : Math.min(...waiting);
}

import { cleanup } from "@solidjs/testing-library";
import { afterEach, beforeEach, vi } from "vitest";

/**
 * Runs each test of the enclosing suite on a fake clock. Motion's frame loop
 * reads `performance.now()` and schedules with `requestAnimationFrame`; both
 * are faked together with the timers, so an animation's progress depends only
 * on how far the test has advanced the clock and not on how busy the machine
 * is.
 */
export function useFakeClock(): void {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // Motion's frame batcher stays "scheduled" until the frame it asked for
    // fires. Dropping a pending fake frame would leave it waiting forever and
    // stall every later test, so components are disposed (which cancels their
    // animations) and the frame already requested is run before the real clock
    // returns.
    cleanup();
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });
}

/** Moves the fake clock forward, running every frame and timer due on the way. */
export async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

const FRAME_MS = 16;

function trackSettled(promise: Promise<unknown>): { done: boolean } {
  const state = { done: false };
  const markDone = () => {
    state.done = true;
  };

  promise.then(markDone, markDone);

  return state;
}

/**
 * Advances the fake clock frame by frame until `promise` settles, then returns
 * its result. Fails after `limit` ms of fake time instead of hanging the test
 * on an animation that never finishes.
 */
export async function settled<T>(
  promise: Promise<T>,
  limit = 10_000,
): Promise<T> {
  const state = trackSettled(promise);

  for (let elapsed = 0; !state.done && elapsed < limit; elapsed += FRAME_MS) {
    // eslint-disable-next-line no-await-in-loop
    await advance(FRAME_MS);
  }

  if (!state.done) {
    throw new Error(`promise still pending after ${limit}ms of fake time`);
  }

  return promise;
}

/**
 * Reports whether `promise` settled within `ms` of fake time. Replaces racing
 * it against a timer: a promise that never settles fails the assertion
 * instead of hanging the test.
 */
export async function outcomeWithin(
  promise: Promise<unknown>,
  ms: number,
): Promise<"settled" | "pending"> {
  const state = trackSettled(promise);

  await advance(ms);

  return state.done ? "settled" : "pending";
}

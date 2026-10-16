const MAX_BACKOFF_MS = 5 * 60 * 1000;

/** Retry delay doubles per attempt and never exceeds five minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, 2 ** attempts * 1000);
}

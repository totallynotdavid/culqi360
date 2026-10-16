const MAX_BACKOFF_MS = 5 * 60 * 1000;

/**
 * Retry delay: the ceiling doubles per attempt up to five minutes, and the
 * delay is a random point between half the ceiling and all of it. Without the
 * spread every extension that saw the same outage would come back at the same
 * second. The floor keeps a retry from firing at once.
 */
export function backoffMs(attempts: number): number {
  const ceiling = Math.min(MAX_BACKOFF_MS, 2 ** attempts * 1000);
  return ceiling / 2 + (Math.random() * ceiling) / 2;
}

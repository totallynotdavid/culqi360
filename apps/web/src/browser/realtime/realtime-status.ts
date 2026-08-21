import { createEffect, createSignal, type Accessor } from "solid-js";

import type { ConnectionState } from "./connection-lifecycle";

/**
 * How many live subscriptions are currently degraded, app-wide.
 *
 * Losing the feed is one fact about the page, not about whichever card noticed
 * it, so it is reported once by the shell instead of by every subscriber. Module
 * scope rather than a context because it is written only from browser
 * connection callbacks: on the server both counts stay zero.
 */
const [offlineCount, setOfflineCount] = createSignal(0);
const [deniedCount, setDeniedCount] = createSignal(0);

export type RealtimeStatus = "live" | "offline" | "denied";

/** Denied outranks offline: it needs a reload rather than patience. */
export function realtimeStatus(): RealtimeStatus {
  if (deniedCount() > 0) {
    return "denied";
  }

  return offlineCount() > 0 ? "offline" : "live";
}

export function trackRealtimeConnection(
  state: Accessor<ConnectionState>,
): void {
  createEffect(state, (current) => {
    if (current !== "offline" && current !== "denied") {
      return;
    }

    const setCount = current === "denied" ? setDeniedCount : setOfflineCount;

    setCount((count) => count + 1);

    // The effect's cleanup, so recovering, switching subject, or unmounting all
    // release the same way.
    return () => setCount((count) => count - 1);
  });
}

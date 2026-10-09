import { Show } from "solid-js";

import { realtimeStatus } from "./realtime-status";

import styles from "./realtime-status-banner.module.css";

/**
 * The one place a lost live feed is reported. A lost feed is an infrastructure
 * fact, not a property of whichever card noticed it first.
 */
export function RealtimeStatusBanner() {
  return (
    <Show when={realtimeStatus() !== "live"}>
      <Show
        when={realtimeStatus() === "denied"}
        fallback={
          <div class={`${styles.banner} ${styles.offline}`} role="status">
            Sin conexión en vivo. Reintentando...
          </div>
        }
      >
        <div class={`${styles.banner} ${styles.denied}`} role="alert">
          Se perdió la conexión en vivo. Recarga la página.
        </div>
      </Show>
    </Show>
  );
}

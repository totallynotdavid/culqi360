import { Show } from "solid-js";

import { realtimeStatus } from "./realtime-status";

import styles from "./realtime-status-banner.module.css";

/**
 * The one place a lost live feed is reported.
 *
 * Every subscriber used to render its own copy of these two sentences, which
 * made an infrastructure fact look like a property of whichever card happened to
 * notice it first.
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

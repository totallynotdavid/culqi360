import { createEffect, createSignal } from "solid-js";

import { useDataGrid } from "../context/instance-context";
import type { DataGridLoadMore } from "../model/types";

import styles from "../styles/table.module.css";

export function DataGridLoadMoreSentinel(props: { config: DataGridLoadMore }) {
  const grid = useDataGrid();

  // A signal rather than a ref variable: the effect below has to re-run once
  // the element exists, and a plain `let` is invisible to it.
  const [sentinel, setSentinel] = createSignal<HTMLDivElement>();

  createEffect(
    () => ({
      root: grid.getScrollWrapper(),
      element: sentinel(),
      hasMore: props.config.hasMore,
    }),
    ({ root, element, hasMore }) => {
      if (!root || !element || !hasMore) {
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting && !props.config.loading) {
            void props.config.onLoadMore();
          }
        },
        { root, rootMargin: "400px" },
      );

      observer.observe(element);

      return () => observer.disconnect();
    },
  );

  return (
    <div ref={setSentinel} class={styles.loadMoreSentinel} aria-hidden="true">
      {props.config.loading ? "Cargando más..." : null}
    </div>
  );
}

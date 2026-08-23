import { Dynamic } from "@solidjs/web";
import { Show } from "solid-js";

import { useDataGrid } from "../context/instance-context";
import type { DataGridActionRowConfig } from "../model/types";

import styles from "../styles/table.module.css";

function getLabelGridColumnStart(
  labelColumnIndex: number,
  leadingColumnCount: number,
) {
  return labelColumnIndex + 1 + leadingColumnCount;
}

export function DataGridActionRow(props: {
  ariaRowIndex: number;
  config: DataGridActionRowConfig;
  labelColumnIndex: number;
  stickyColumnIndex: number;
}) {
  const grid = useDataGrid();

  const labelStart = () =>
    getLabelGridColumnStart(
      props.labelColumnIndex,
      Number(grid.reorder !== undefined) + Number(grid.selection !== undefined),
    );

  return (
    // oxlint click-events-have-key-events is suppressed: the nested <button>
    // owns Enter/Space activation and bubbles its click to this row.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      class={styles.actionRow}
      role="row"
      aria-rowindex={props.ariaRowIndex}
      onClick={() => {
        if (grid.isInteractive()) {
          props.config.onClick();
        }
      }}
    >
      <Show when={grid.reorder}>
        <span
          class={`${styles.actionCell} ${styles.reorderCell}`}
          aria-hidden="true"
          role="presentation"
        />
      </Show>
      <Show when={grid.selection}>
        <span
          class={`${styles.actionCell} ${styles.checkboxCell}`}
          aria-hidden="true"
          role="presentation"
        >
          <span class={styles.actionIcon} aria-hidden="true">
            <Dynamic component={props.config.icon} size={14} />
          </span>
        </span>
      </Show>
      <span
        class={`${styles.actionCell} ${props.labelColumnIndex === props.stickyColumnIndex ? styles.stickyCell : ""}`}
        style={{
          "grid-column": `${labelStart()} / ${labelStart() + 1}`,
        }}
        role="gridcell"
        aria-label={props.config.label}
      >
        <Show when={!grid.selection}>
          <span class={styles.actionIcon} aria-hidden="true">
            <Dynamic component={props.config.icon} size={14} />
          </span>
        </Show>
        <button
          type="button"
          class={styles.actionTrigger}
          disabled={!grid.isInteractive()}
        >
          <span class={styles.actionText}>{props.config.label}</span>
        </button>
      </span>
      <span
        class={styles.actionCell}
        style={{ "grid-column": `${labelStart() + 1} / -1` }}
        aria-hidden="true"
        role="presentation"
      />
    </div>
  );
}

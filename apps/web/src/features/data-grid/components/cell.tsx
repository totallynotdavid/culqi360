import { type JSX } from "@solidjs/web";
import { omit } from "solid-js";

import styles from "../styles/table.module.css";

type DataGridCellProps = JSX.HTMLAttributes<HTMLDivElement> & {
  sticky?: boolean;
};

export function DataGridCell(props: DataGridCellProps) {
  const elementProps = omit(props, "children", "class", "sticky");

  return (
    <div
      {...elementProps}
      class={[styles.bodyCell, props.class, props.sticky && styles.stickyCell]}
    >
      {props.children}
    </div>
  );
}

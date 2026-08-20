import { splitProps } from "solid-js";
import { type JSX } from "@solidjs/web";

import styles from "../styles/table.module.css";

type DataGridCellProps = JSX.HTMLAttributes<HTMLDivElement> & {
  sticky?: boolean;
};

export function DataGridCell(props: DataGridCellProps) {
  const [local, elementProps] = splitProps(props, [
    "children",
    "class",
    "sticky",
  ]);

  return (
    <div
      {...elementProps}
      class={`${styles.bodyCell}${local.class ? ` ${local.class}` : ""}${local.sticky ? ` ${styles.stickyCell}` : ""}`}
    >
      {local.children}
    </div>
  );
}

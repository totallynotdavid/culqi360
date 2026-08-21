import type { JSX } from "@solidjs/web";
import { clsx } from "clsx";

import styles from "./filter-bar.module.css";

interface FilterBarProps {
  children?: JSX.Element;
  class?: string;
}

export function FilterBar(props: FilterBarProps) {
  return (
    <div class={clsx(styles.filterBar, props.class)}>{props.children}</div>
  );
}

import { Dynamic } from "@solidjs/web";

import type { IconComponent } from "~/components/icons/icon-base";

import styles from "./navigation-bar.module.css";

export function NavigationBarItem(props: {
  Icon: IconComponent;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class={[styles.item, props.isActive && styles.itemActive]}
      onClick={() => props.onClick()}
      aria-label={props.label}
    >
      <Dynamic component={props.Icon} size={20} />
    </button>
  );
}

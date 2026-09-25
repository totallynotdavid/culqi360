import { For } from "solid-js";

import type { IconComponent } from "~/components/icons/icon-base";

import { NavigationBarItem } from "./navigation-bar-item";

import styles from "./navigation-bar.module.css";

export type NavigationBarItemDef = {
  name: string;
  label: string;
  Icon: IconComponent;
  onClick: () => void;
};

export function NavigationBar(props: {
  activeItemName: string;
  items: NavigationBarItemDef[];
}) {
  return (
    <nav class={styles.container}>
      <For each={props.items}>
        {(item) => (
          <NavigationBarItem
            Icon={item.Icon}
            label={item.label}
            isActive={props.activeItemName === item.name}
            onClick={item.onClick}
          />
        )}
      </For>
    </nav>
  );
}

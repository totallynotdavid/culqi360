import type { JSX } from "@solidjs/web";
import { Dynamic } from "@solidjs/web";

import type { TileColor } from "~/shared/ui/tile-color";

import styles from "./tinted-icon-tile.module.css";

type TileIcon = (props: { size?: number; color?: string }) => JSX.Element;

export function TintedIconTile(props: {
  Icon: TileIcon;
  color: TileColor;
  size?: number;
}) {
  return (
    <div
      class={styles.tile}
      style={{
        "background-color": `var(--color-${props.color}-5)`,
        "border-color": `var(--color-${props.color}-6)`,
      }}
    >
      <Dynamic
        component={props.Icon}
        size={props.size ?? 16}
        color={`var(--color-${props.color}-11)`}
      />
    </div>
  );
}

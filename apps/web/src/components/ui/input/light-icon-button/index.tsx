import { clsx } from "clsx";
import { splitProps } from "solid-js";
import { type JSX } from "@solidjs/web";

import styles from "./styles.module.css";

export type LightIconButtonAccent = "secondary" | "tertiary";

export interface LightIconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  Icon: (props: { size?: number }) => JSX.Element;
  accent?: LightIconButtonAccent;
  size?: "small" | "medium";
}

export function LightIconButton(props: LightIconButtonProps) {
  const [local, others] = splitProps(props, [
    "Icon",
    "accent",
    "size",
    "class",
    "children",
  ]);

  return (
    <button
      class={clsx(
        styles.button,
        local.accent === "tertiary" && styles.tertiary,
        local.size === "medium" && styles.medium,
        local.class,
      )}
      {...others}
    >
      {local.Icon && <local.Icon size={local.size === "medium" ? 16 : 14} />}
      {local.children}
    </button>
  );
}

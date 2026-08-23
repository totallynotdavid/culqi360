import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { omit } from "solid-js";

import styles from "./styles.module.css";

export type LightIconButtonAccent = "secondary" | "tertiary";

export interface LightIconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  Icon: (props: { size?: number }) => JSX.Element;
  accent?: LightIconButtonAccent;
  size?: "small" | "medium";
}

export function LightIconButton(props: LightIconButtonProps) {
  const others = omit(props, "Icon", "accent", "size", "class", "children");

  return (
    <button
      class={clsx(
        styles.button,
        props.accent === "tertiary" && styles.tertiary,
        props.size === "medium" && styles.medium,
        props.class,
      )}
      {...others}
    >
      {props.Icon && <props.Icon size={props.size === "medium" ? 16 : 14} />}
      {props.children}
    </button>
  );
}

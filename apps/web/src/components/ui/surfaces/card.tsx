import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { omit } from "solid-js";

import styles from "./card.module.css";

type CardProps = JSX.HTMLAttributes<HTMLDivElement> & {
  fullWidth?: boolean;
  rounded?: boolean;
  backgroundColor?: string;
};

export const Card = (props: CardProps) => {
  const others = omit(
    props,
    "class",
    "fullWidth",
    "rounded",
    "backgroundColor",
    "style",
  );
  return (
    <div
      data-full-width={props.fullWidth ? "" : undefined}
      data-rounded={props.rounded ? "" : undefined}
      class={clsx(styles.card, props.class)}
      style={{
        ...(typeof props.style === "object" ? props.style : {}),
        ...(props.backgroundColor
          ? { "--card-background-color": props.backgroundColor }
          : {}),
      }}
      {...others}
    />
  );
};

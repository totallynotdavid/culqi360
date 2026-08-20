import { clsx } from "clsx";
import { splitProps } from "solid-js";
import { type JSX } from "@solidjs/web";

import styles from "./card.module.css";

type CardProps = JSX.HTMLAttributes<HTMLDivElement> & {
  fullWidth?: boolean;
  rounded?: boolean;
  backgroundColor?: string;
};

export const Card = (props: CardProps) => {
  const [local, others] = splitProps(props, [
    "class",
    "fullWidth",
    "rounded",
    "backgroundColor",
    "style",
  ]);
  return (
    <div
      data-full-width={local.fullWidth ? "" : undefined}
      data-rounded={local.rounded ? "" : undefined}
      class={clsx(styles.card, local.class)}
      style={{
        ...(typeof local.style === "object" ? local.style : {}),
        ...(local.backgroundColor
          ? { "--card-background-color": local.backgroundColor }
          : {}),
      }}
      {...others}
    />
  );
};

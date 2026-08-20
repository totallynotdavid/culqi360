import type { JSX } from "@solidjs/web";
import { clsx } from "clsx";

import styles from "./field.module.css";

type InputLabelProps = Omit<
  JSX.LabelHTMLAttributes<HTMLLabelElement>,
  "for"
> & {
  for: string;
};

export function InputLabel(props: InputLabelProps) {
  return (
    <label for={props.for} class={clsx(styles.label, props.class)}>
      {props.children}
    </label>
  );
}

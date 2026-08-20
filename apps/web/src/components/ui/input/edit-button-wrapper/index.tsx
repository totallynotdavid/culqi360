import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";

import styles from "./styles.module.css";

export interface EditButtonWrapperProps {
  visible?: boolean;
  children: JSX.Element;
}

export function EditButtonWrapper(props: EditButtonWrapperProps) {
  return (
    <div
      class={clsx(styles.wrapper, (props.visible ?? false) && styles.visible)}
    >
      {props.children}
    </div>
  );
}

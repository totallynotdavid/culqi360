import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";

import styles from "./scroll-wrapper.module.css";

type ScrollWrapperProps = {
  class?: string;
  children: JSX.Element;
};

export function ScrollWrapper(props: ScrollWrapperProps) {
  return <div class={clsx(styles.scroll, props.class)}>{props.children}</div>;
}

import { type JSX } from "@solidjs/web";

import styles from "./skeleton.module.css";

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  radius?: number;
};

function toSize(value: number | string | undefined, fallback: string): string {
  if (value === undefined) {
    return fallback;
  }
  return typeof value === "number" ? `${value}px` : value;
}

export const Skeleton = (props: SkeletonProps): JSX.Element => (
  <span
    class={styles.skeleton}
    style={{
      width: toSize(props.width, "100%"),
      height: toSize(props.height, "16px"),
      "border-radius": `${props.radius ?? 4}px`,
    }}
  />
);

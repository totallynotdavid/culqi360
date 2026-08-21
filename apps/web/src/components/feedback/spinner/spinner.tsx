import { clsx } from "clsx";

import LoaderCircle from "~/components/icons/loader-circle";

import styles from "./spinner.module.css";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

export function Spinner(props: SpinnerProps) {
  const sizeClass = () => {
    switch (props.size) {
      case "sm":
        return styles.sm;
      case "lg":
        return styles.lg;
      default:
        return styles.md;
    }
  };

  return (
    <div class={styles.root}>
      <LoaderCircle class={clsx(styles.spinner, sizeClass())} />
    </div>
  );
}

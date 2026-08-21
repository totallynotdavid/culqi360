import type { JSX } from "@solidjs/web";

import {
  AnimatedPlaceholder,
  type AnimatedPlaceholderType,
} from "~/components/layout/animated-placeholder";
import { Button } from "~/components/ui/input/button";

import styles from "./empty-state.module.css";

export function ActivityTabEmptyState(props: {
  type: AnimatedPlaceholderType;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onActionClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
}) {
  return (
    <div class={styles.container}>
      <AnimatedPlaceholder type={props.type} />
      <div class={styles.textContainer}>
        <div class={styles.title}>{props.title}</div>
        <div class={styles.subtitle}>{props.subtitle}</div>
      </div>
      {props.actionLabel ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={props.onActionClick}
          disabled={!props.onActionClick}
        >
          {props.actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

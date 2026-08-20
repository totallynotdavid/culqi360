import { type JSX } from "@solidjs/web";
import { createSignal, onSettled, type ParentProps } from "solid-js";

import styles from "./overflow-tooltip.module.css";

interface OverflowingTextProps {
  text: string;
  class?: string;
  style?: JSX.CSSProperties;
  maxRows?: number;
}

export function OverflowingText(props: OverflowingTextProps) {
  const [textElement, setTextElement] = createSignal<HTMLSpanElement | null>(
    null,
  );
  const [isOverflowing, setIsOverflowing] = createSignal(false);

  const maxRows = () => props.maxRows ?? 1;
  const isClamped = () => maxRows() > 1;

  function measure() {
    const element = textElement();

    if (!element) {
      return;
    }

    setIsOverflowing(
      isClamped()
        ? element.scrollHeight > element.clientHeight
        : element.scrollWidth > element.clientWidth,
    );
  }

  onSettled(() => {
    measure();

    const observer = new ResizeObserver(measure);
    const element = textElement();

    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  });

  return (
    <span
      class={`${styles.wrapper}${props.class ? ` ${props.class}` : ""}`}
      style={props.style}
    >
      <span
        ref={setTextElement}
        class={isClamped() ? styles.textClamp : styles.text}
        style={isClamped() ? { "--max-rows": maxRows() } : undefined}
      >
        {props.text}
      </span>

      {isOverflowing() && (
        <span class={styles.tooltip} role="tooltip">
          {props.text}
        </span>
      )}
    </span>
  );
}

export function WithTooltip(
  props: ParentProps<{
    tooltip: string;
    disabled?: boolean;
    position?: "top" | "right";
    class?: string;
  }>,
) {
  return (
    <span class={`${styles.wrapper}${props.class ? ` ${props.class}` : ""}`}>
      {props.children}

      {!props.disabled && (
        <span
          class={
            props.position === "right"
              ? `${styles.tooltip} ${styles.tooltipRight}`
              : styles.tooltip
          }
          role="tooltip"
        >
          {props.tooltip}
        </span>
      )}
    </span>
  );
}

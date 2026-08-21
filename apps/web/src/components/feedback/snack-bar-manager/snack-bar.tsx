import type { JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { Show } from "solid-js";

import CircleAlert from "~/components/icons/circle-alert";
import CircleCheckBig from "~/components/icons/circle-check-big";
import Info from "~/components/icons/info";
import X from "~/components/icons/x";
import { Button } from "~/components/ui/input/button";

import type { SnackBarItem, SnackBarVariant } from "./types";

import styles from "./snack-bar.module.css";

const variantStyles = {
  success: styles.success,
  error: styles.error,
  info: styles.info,
  warning: styles.warning,
  default: styles.default,
} satisfies Record<SnackBarVariant, string>;

const iconByVariant = {
  success: (): JSX.Element => <CircleCheckBig size={16} />,
  info: (): JSX.Element => <Info size={16} />,
  error: (): JSX.Element => <CircleAlert size={16} />,
  warning: (): JSX.Element => <CircleAlert size={16} />,
  default: (): JSX.Element => <CircleAlert size={16} />,
} satisfies Record<SnackBarVariant, () => JSX.Element>;

interface SnackBarProps {
  item: SnackBarItem;
  onDismiss: () => void;
}

export function SnackBar(props: SnackBarProps) {
  return (
    <div
      class={clsx(styles.snackBar, variantStyles[props.item.variant])}
      role={props.item.role}
      aria-live={props.item.role === "alert" ? "assertive" : "polite"}
      data-globally-prevent-click-outside
    >
      <Show when={props.item.duration > 0 ? props.item.duration : null} keyed>
        {(duration) => (
          <div
            class={styles.countdown}
            style={{ "animation-duration": `${duration}ms` }}
            onAnimationEnd={props.onDismiss}
          />
        )}
      </Show>
      <div class={styles.header}>
        <div class={styles.icon}>
          {props.item.icon ?? iconByVariant[props.item.variant]()}
        </div>
        <p class={styles.message}>{props.item.message}</p>
        <div class={styles.actions}>
          <Show when={props.item.onCancel}>
            {(onCancel) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class={styles.cancel}
                onClick={onCancel()}
              >
                Cancelar
              </Button>
            )}
          </Show>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={props.onDismiss}
            class={styles.dismiss}
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      <Show when={props.item.detailedMessage}>
        {(message) => <p class={styles.details}>{message()}</p>}
      </Show>

      <Show
        when={
          props.item.buttonLabel &&
          (props.item.buttonOnClick || props.item.buttonTo)
        }
      >
        <div class={styles.bottomActionContainer}>
          <hr class={styles.separator} />
          <div class={styles.bottomAction}>
            <Show
              when={props.item.buttonTo}
              fallback={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class={styles.action}
                  onClick={props.item.buttonOnClick ?? undefined}
                >
                  {props.item.buttonLabel}
                </Button>
              }
            >
              {(href) => (
                <a href={href()} class={styles.actionLink}>
                  {props.item.buttonLabel}
                </a>
              )}
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

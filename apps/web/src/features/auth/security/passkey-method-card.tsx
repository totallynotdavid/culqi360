import { Show } from "solid-js";

import Phone from "~/components/icons/phone";
import { Button } from "~/components/ui/input/button";

import styles from "./security-enrollment-panel.module.css";

interface PasskeyMethodCardProps {
  title: string;
  description: string;
  statusLabel: string;
  active: boolean;
  supported: boolean;
  loading: boolean;
  actionLabel: string;
  note?: string;
  unsupportedNote?: string;
  onAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function PasskeyMethodCard(props: PasskeyMethodCardProps) {
  return (
    <article class={styles.methodCard}>
      <div class={styles.methodHeader}>
        <div class={styles.methodIcon}>
          <Phone size={18} />
        </div>
        <div class={styles.methodCopy}>
          <h3 class={styles.methodTitle}>{props.title}</h3>
          <p class={styles.methodDescription}>{props.description}</p>
        </div>
        <span
          class={[styles.statusPill, props.active && styles.statusPillSuccess]}
        >
          {props.statusLabel}
        </span>
      </div>

      <div class={styles.methodActions}>
        <div class={styles.buttonRow}>
          <Button
            type="button"
            variant={props.active ? "outline" : "primary"}
            disabled={!props.supported || props.loading}
            loading={props.loading}
            onClick={props.onAction}
          >
            {props.actionLabel}
          </Button>
          <Show when={props.secondaryActionLabel && props.onSecondaryAction}>
            <Button
              type="button"
              variant="ghost"
              disabled={props.loading}
              onClick={() => props.onSecondaryAction?.()}
            >
              {props.secondaryActionLabel}
            </Button>
          </Show>
        </div>
        <Show when={props.note}>
          {(note) => <p class={styles.methodHint}>{note()}</p>}
        </Show>
        <Show when={!props.supported && props.unsupportedNote}>
          {(note) => <p class={styles.methodHint}>{note()}</p>}
        </Show>
      </div>
    </article>
  );
}

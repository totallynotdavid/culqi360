import { type JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { createEffect } from "solid-js";

import { PresenceTransition } from "~/components/ui/animation/presence-transition";
import { Button } from "~/components/ui/input/button";

import styles from "./confirm-dialog.module.css";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "primary" | "outline" | "ghost" | "destructive";
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: JSX.Element;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  createEffect(
    () => props.isOpen,
    (isOpen) => {
      if (!isOpen) {
        return;
      }

      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !props.loading) {
          props.onClose();
        }
      };

      document.addEventListener("keydown", handler);

      return () => document.removeEventListener("keydown", handler);
    },
  );

  return (
    <Portal>
      <PresenceTransition show={props.isOpen}>
        <div
          class={styles.overlay}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !props.loading) {
              props.onClose();
            }
          }}
        >
          <dialog open class={styles.dialog} aria-modal="true">
            <div class={styles.header}>
              <h3 class={styles.title}>{props.title}</h3>
              <p class={styles.description}>{props.description}</p>
            </div>
            {props.children}
            <div class={styles.actions}>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={props.loading}
                onClick={props.onClose}
              >
                {props.cancelLabel ?? "Cancelar"}
              </Button>
              <Button
                type="button"
                variant={props.variant ?? "primary"}
                size="lg"
                loading={props.loading}
                disabled={props.confirmDisabled}
                onClick={props.onConfirm}
              >
                {props.confirmLabel}
              </Button>
            </div>
          </dialog>
        </div>
      </PresenceTransition>
    </Portal>
  );
}

import { Portal } from "@solidjs/web";
import { createEffect, Match, Show, Switch } from "solid-js";

import { PresenceTransition } from "~/components/ui/animation/presence-transition";
import { Button } from "~/components/ui/input/button";

import { getFileCategoryFromMime } from "./file-category";

import styles from "./files.module.css";

export type PreviewFile = {
  previewId: string;
  fileId: string;
  filename: string;
  detectedMime: string;
};

export type PreviewModalState = {
  file: PreviewFile;
  previewUrl: string;
  onDownload: () => Promise<void> | void;
};

type PreviewModalProps = {
  state: PreviewModalState | null;
  onClose: () => void;
};

export function PreviewModal(props: PreviewModalProps) {
  createEffect(
    () => Boolean(props.state),
    (isOpen) => {
      if (!isOpen) {
        return;
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          props.onClose();
        }
      };

      window.document.addEventListener("keydown", onKeyDown);

      return () => window.document.removeEventListener("keydown", onKeyDown);
    },
  );

  const category = () =>
    props.state
      ? getFileCategoryFromMime(props.state.file.detectedMime)
      : "other";

  return (
    <Portal>
      <PresenceTransition show={Boolean(props.state)}>
        <Show when={props.state}>
          {(state) => (
            <div
              class={styles.previewOverlay}
              role="presentation"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  props.onClose();
                }
              }}
            >
              <dialog
                open
                class={styles.previewDialog}
                aria-modal="true"
                aria-labelledby={`preview-title-${state().file.previewId}`}
              >
                <header class={styles.previewHeader}>
                  <h3
                    id={`preview-title-${state().file.previewId}`}
                    class={styles.previewTitle}
                  >
                    {state().file.filename}
                  </h3>
                  <div class={styles.previewActions}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void state().onDownload()}
                    >
                      Descargar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={props.onClose}
                    >
                      Cerrar
                    </Button>
                  </div>
                </header>
                <div class={styles.previewBody}>
                  <Switch>
                    <Match when={category() === "image"}>
                      <div class={styles.previewImageWrap}>
                        <img
                          src={state().previewUrl}
                          alt={state().file.filename}
                          class={styles.previewImage}
                        />
                      </div>
                    </Match>
                    <Match
                      when={state().file.detectedMime === "application/pdf"}
                    >
                      <iframe
                        src={state().previewUrl}
                        title={state().file.filename}
                        class={styles.previewFrame}
                      />
                    </Match>
                    <Match when={true}>
                      <div class={styles.previewFallback}>
                        <p>
                          Vista previa no disponible para este tipo de archivo.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void state().onDownload()}
                        >
                          Descargar archivo
                        </Button>
                      </div>
                    </Match>
                  </Switch>
                </div>
              </dialog>
            </div>
          )}
        </Show>
      </PresenceTransition>
    </Portal>
  );
}

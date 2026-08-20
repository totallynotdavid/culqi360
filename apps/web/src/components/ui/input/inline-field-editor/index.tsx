import { clsx } from "clsx";
import { createSignal, For, onSettled, Show } from "solid-js";

import { Button } from "~/components/ui/input/button";
import { useDismissibleLayer } from "~/components/ui/utilities/use-dismissible-layer";

import styles from "./styles.module.css";

function editorErrorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "No se pudo guardar";
}

export interface InlineFieldEditorProps {
  initialValue: string;
  ariaLabel: string;
  type?: "text" | "number";
  step?: string;
  min?: string;
  placeholder?: string;
  saveLabel?: string;
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
}

export function InlineFieldEditor(props: InlineFieldEditorProps) {
  const [value, setValue] = createSignal(props.initialValue);
  const [submitting, setSubmitting] = createSignal(false);
  const [saveErrorMessage, setSaveErrorMessage] = createSignal<string | null>(
    null,
  );

  let containerRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  onSettled(() => {
    inputRef?.focus();
    inputRef?.select();
  });

  useDismissibleLayer({
    enabled: () => !submitting(),
    onDismiss: () => props.onClose(),
    getContainer: () => containerRef,
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (submitting()) {
      return;
    }

    setSaveErrorMessage(null);
    setSubmitting(true);

    try {
      await props.onSubmit(value());
      props.onClose();
    } catch (caught) {
      setSaveErrorMessage(editorErrorMessage(caught));
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || submitting()) {
      return;
    }

    event.preventDefault();
    props.onClose();
  }

  return (
    <div ref={(element) => (containerRef = element)} class={styles.popover}>
      <form class={styles.form} onSubmit={(event) => void handleSubmit(event)}>
        <input
          ref={(element) => (inputRef = element)}
          class={styles.input}
          type={props.type ?? "text"}
          step={props.step}
          min={props.min}
          placeholder={props.placeholder}
          aria-label={props.ariaLabel}
          value={value()}
          onInput={(event) => setValue(event.currentTarget.value)}
          disabled={submitting()}
          onKeyDown={handleKeyDown}
        />

        <Show when={saveErrorMessage()}>
          {(message) => <p class={styles.error}>{message()}</p>}
        </Show>

        <div class={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={submitting()}
            onClick={() => props.onClose()}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting()}
          >
            {props.saveLabel ?? "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export interface InlineOptionsEditorProps<T extends string> {
  options: readonly T[];
  selected: T;
  ariaLabel: string;
  onSubmit: (value: T) => Promise<void>;
  onClose: () => void;
}

export function InlineOptionsEditor<T extends string>(
  props: InlineOptionsEditorProps<T>,
) {
  const [submitting, setSubmitting] = createSignal(false);
  const [saveErrorMessage, setSaveErrorMessage] = createSignal<string | null>(
    null,
  );

  let containerRef: HTMLDivElement | undefined;

  useDismissibleLayer({
    enabled: () => !submitting(),
    onDismiss: () => props.onClose(),
    getContainer: () => containerRef,
  });

  async function handleSelect(option: T) {
    if (submitting()) {
      return;
    }

    if (option === props.selected) {
      props.onClose();
      return;
    }

    setSaveErrorMessage(null);
    setSubmitting(true);

    try {
      await props.onSubmit(option);
      props.onClose();
    } catch (caught) {
      setSaveErrorMessage(editorErrorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <div ref={(element) => (containerRef = element)} class={styles.popover}>
      <Show when={saveErrorMessage()}>
        {(message) => <p class={styles.error}>{message()}</p>}
      </Show>

      <ul class={styles.list} aria-label={props.ariaLabel}>
        <For each={props.options}>
          {(option) => (
            <li>
              <button
                type="button"
                class={clsx(
                  styles.item,
                  option === props.selected && styles.itemSelected,
                )}
                disabled={submitting()}
                onClick={() => void handleSelect(option)}
              >
                <span>{option}</span>

                <Show when={option === props.selected}>
                  <span class={styles.selectedBadge}>Actual</span>
                </Show>
              </button>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

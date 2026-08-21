import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { createSignal, omit } from "solid-js";

import styles from "./file-dropzone.module.css";

export interface FileDropzoneProps extends Omit<
  JSX.HTMLAttributes<HTMLButtonElement>,
  "onChange" | "children"
> {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  // The host button routes its click to the hidden file input, so consumers
  // pass visible content here instead of wrapping children in a `<label>`.
  children: (state: { dragging: boolean }) => JSX.Element;
  // Defaults to "button" so the dropzone never submits an enclosing form.
  type?: "button" | "submit" | "reset";
}

export function FileDropzone(props: FileDropzoneProps) {
  const rest = omit(
    props,
    "accept",
    "multiple",
    "disabled",
    "onFiles",
    "children",
    "class",
    "type",
  );

  const [dragging, setDragging] = createSignal(false);
  let inputRef: HTMLInputElement | null = null;

  const setInputRef = (element: HTMLInputElement) => {
    inputRef = element;
  };

  function openPicker() {
    if (props.disabled) {
      return;
    }
    inputRef?.click();
  }

  function onInputChange(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const files = Array.from(target.files ?? []);
    if (files.length > 0) {
      props.onFiles(files);
    }
    target.value = "";
  }

  function onDragEnter(event: DragEvent) {
    if (props.disabled) {
      return;
    }
    if (!event.dataTransfer?.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    setDragging(true);
  }

  function onDragOver(event: DragEvent) {
    if (props.disabled) {
      return;
    }
    if (!event.dataTransfer?.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    if (!dragging()) {
      setDragging(true);
    }
  }

  function onDragLeave(event: DragEvent) {
    if (props.disabled) {
      return;
    }
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      setDragging(false);
      return;
    }
    const next = event.relatedTarget;
    if (next instanceof Node && target.contains(next)) {
      return;
    }
    setDragging(false);
  }

  function onDrop(event: DragEvent) {
    if (props.disabled) {
      return;
    }
    if (!event.dataTransfer?.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      props.onFiles(files);
    }
  }

  function onClick(event: MouseEvent) {
    if (props.disabled) {
      return;
    }
    if (event.target === inputRef) {
      return;
    }
    event.preventDefault();
    openPicker();
  }

  return (
    <>
      <input
        ref={setInputRef}
        type="file"
        class={styles.input}
        accept={props.accept}
        multiple={props.multiple}
        tabindex={-1}
        aria-hidden="true"
        onChange={onInputChange}
      />
      <button
        {...rest}
        type={props.type ?? "button"}
        class={clsx(
          styles.host,
          props.disabled && styles.disabled,
          props.class,
        )}
        disabled={props.disabled}
        onClick={onClick}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {props.children({ dragging: dragging() })}
      </button>
    </>
  );
}

import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { omit } from "solid-js";

import Search from "~/components/icons/search";

import styles from "./search-input.module.css";

interface SearchInputProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "onInput" | "value" | "type"
> {
  value: string;
  onValueChange: (value: string) => void;
}

export function SearchInput(props: SearchInputProps) {
  const others = omit(props, "value", "onValueChange", "class");

  return (
    <div class={clsx(styles.wrapper, props.class)}>
      <div class={styles.inputContainer}>
        <span class={styles.iconContainer} aria-hidden="true">
          <Search size={16} />
        </span>
        <input
          type="search"
          class={styles.input}
          value={props.value}
          onInput={(event) => props.onValueChange(event.currentTarget.value)}
          {...others}
        />
      </div>
    </div>
  );
}

import { For } from "solid-js";

import type {
  UpdateFilter,
  UpdateFilterOption,
} from "~/features/updates/model";

import styles from "./styles/filters.module.css";

type UpdatesFiltersProps = {
  active: UpdateFilter;
  onChange: (value: UpdateFilter) => void;
  options: readonly UpdateFilterOption[];
};

export function UpdatesFilters(props: UpdatesFiltersProps) {
  return (
    <nav class={styles.filterBar} aria-label="Categorías de actualizaciones">
      <For each={props.options}>
        {(option) => (
          <button
            class={[
              styles.filterButton,
              props.active === option.value && styles.filterButtonActive,
            ]}
            onClick={() => props.onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        )}
      </For>
    </nav>
  );
}

import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";

import Search from "~/components/icons/search";
import { useDismissibleLayer } from "~/components/ui/utilities/use-dismissible-layer";

import styles from "./styles.module.css";

export type UserPickerOption = {
  id: string;
  fullName: string;
};

export interface UserPickerProps {
  currentUserId: string;
  fetchUsers: (search: string) => Promise<UserPickerOption[]>;
  onSelect: (id: string) => Promise<void>;
  onClose: () => void;
}

export function UserPicker(props: UserPickerProps) {
  const [search, setSearch] = createSignal("");
  const [debouncedSearch, setDebouncedSearch] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [selectionErrorMessage, setSelectionErrorMessage] = createSignal<
    string | null
  >(null);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let containerRef: HTMLDivElement | undefined;

  const users = createMemo(() => props.fetchUsers(debouncedSearch()));

  function handleSearchInput(value: string) {
    setSearch(value);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => setDebouncedSearch(value), 150);
  }

  onCleanup(() => clearTimeout(debounceTimer));

  useDismissibleLayer({
    enabled: () => true,
    onDismiss: () => props.onClose(),
    getContainer: () => containerRef,
  });

  async function handleSelect(userId: string) {
    if (userId === props.currentUserId) {
      props.onClose();
      return;
    }
    setSelectionErrorMessage(null);
    setSubmitting(true);
    try {
      await props.onSelect(userId);
      props.onClose();
    } catch (caught) {
      setSelectionErrorMessage(
        caught instanceof Error
          ? caught.message
          : "Error al seleccionar usuario",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div ref={(el) => (containerRef = el)} class={styles.container}>
      <div class={styles.searchWrapper}>
        <Search size={14} />
        <input
          type="text"
          class={styles.searchInput}
          placeholder="Buscar..."
          aria-label="Buscar usuario"
          value={search()}
          onInput={(e) => handleSearchInput(e.currentTarget.value)}
          disabled={submitting()}
        />
      </div>
      <Show when={selectionErrorMessage()}>
        <p class={styles.error}>{selectionErrorMessage()}</p>
      </Show>
      <ul class={styles.list}>
        <Show
          when={users() !== undefined}
          fallback={<li class={styles.loadingHint}>Buscando...</li>}
        >
          <For each={users() ?? []}>
            {(user) => (
              <li>
                <button
                  type="button"
                  class={styles.item}
                  onClick={() => void handleSelect(user.id)}
                  disabled={submitting()}
                >
                  <span
                    class={
                      user.id === props.currentUserId ? styles.current : ""
                    }
                  >
                    {user.fullName}
                  </span>
                  <Show when={user.id === props.currentUserId}>
                    <span class={styles.currentBadge}>Actual</span>
                  </Show>
                </button>
              </li>
            )}
          </For>
        </Show>
      </ul>
    </div>
  );
}

import { createMemo, createSignal, For, Show } from "solid-js";

import ChevronDown from "~/components/icons/chevron-down";
import ChevronUp from "~/components/icons/chevron-up";

import { useRecordIndex } from "../../context/record-index-context";
import { RecordIndexToolbarMenu } from "../toolbar-menu";
import { DropdownMenuHeader } from "./menu-primitives";

import sharedStyles from "../../styles/menu.module.css";

type SortDirection = "asc" | "desc";

type SortMenuProps = {
  isOpen: boolean;
  onToggle: () => void;
  onDismiss: () => void;
};

export function SortMenu(props: SortMenuProps) {
  const recordIndex = useRecordIndex();

  const [sortSearch, setSortSearch] = createSignal("");
  const [sortDirection, setSortDirection] = createSignal<SortDirection>("desc");

  const normalizedSortSearch = createMemo(() =>
    sortSearch().trim().toLocaleLowerCase(),
  );

  const sortOptions = createMemo(
    () => recordIndex.definition.sort?.catalog.options ?? [],
  );

  const filteredSortFields = createMemo(() =>
    (recordIndex.definition.sort?.catalog.fields ?? []).filter((field) =>
      field.label.toLocaleLowerCase().includes(normalizedSortSearch()),
    ),
  );

  function resetSortMenuState() {
    setSortSearch("");
    const current = recordIndex.sorting?.value();
    setSortDirection(current?.endsWith("_asc") ? "asc" : "desc");
  }

  function closeMenu() {
    props.onDismiss();
  }

  function selectSortField(prefix: string) {
    const directionSuffix = sortDirection() === "asc" ? "_asc" : "_desc";
    const target = sortOptions().find(
      (option) => option.value === `${prefix}${directionSuffix}`,
    );

    if (target) {
      recordIndex.sorting?.set(target.value);
    }

    setSortSearch("");
    closeMenu();
  }

  return (
    <Show when={recordIndex.definition.sort?.catalog}>
      {(sort) => (
        <RecordIndexToolbarMenu
          active={Boolean(recordIndex.sorting?.isActive())}
          label={sort().label}
          menuId={sort().menuId}
          open={props.isOpen}
          wide
          onDismiss={() => {
            resetSortMenuState();
            props.onDismiss();
          }}
          onToggle={() => {
            if (!props.isOpen) {
              resetSortMenuState();
            }
            props.onToggle();
          }}
        >
          <DropdownMenuHeader
            title="Ordenar"
            onClose={() => {
              resetSortMenuState();
              closeMenu();
            }}
          />
          <div class={sharedStyles.menuGroupLabel}>Direccion</div>
          <div class={sharedStyles.menuListbox}>
            <button
              type="button"
              class={sharedStyles.menuItem}
              data-active={sortDirection() === "asc" ? "true" : "false"}
              aria-pressed={sortDirection() === "asc" ? "true" : "false"}
              onClick={() => setSortDirection("asc")}
            >
              <span class={sharedStyles.menuItemIcon}>
                <ChevronUp size={16} />
              </span>
              <span>Ascendente</span>
            </button>
            <button
              type="button"
              class={sharedStyles.menuItem}
              data-active={sortDirection() === "desc" ? "true" : "false"}
              aria-pressed={sortDirection() === "desc" ? "true" : "false"}
              onClick={() => setSortDirection("desc")}
            >
              <span class={sharedStyles.menuItemIcon}>
                <ChevronDown size={16} />
              </span>
              <span>Descendente</span>
            </button>
          </div>
          <input
            type="search"
            class={sharedStyles.menuSearchInput}
            value={sortSearch()}
            placeholder="Buscar campos"
            onInput={(event) => setSortSearch(event.currentTarget.value)}
          />
          <div class={sharedStyles.menuScrollable}>
            <div class={sharedStyles.menuGroupLabel}>Campos ordenables</div>
            <div class={sharedStyles.menuListbox}>
              <For each={filteredSortFields()}>
                {(fieldOption) => {
                  const FieldIcon = fieldOption.icon;
                  const isActive = () =>
                    (recordIndex.sorting?.value() ?? "").startsWith(
                      `${fieldOption.prefix}_`,
                    );

                  return (
                    <button
                      type="button"
                      class={sharedStyles.menuItem}
                      data-active={isActive() ? "true" : "false"}
                      aria-pressed={isActive() ? "true" : "false"}
                      onClick={() => selectSortField(fieldOption.prefix)}
                    >
                      <span class={sharedStyles.menuItemIcon}>
                        <FieldIcon size={16} />
                      </span>
                      <span>{fieldOption.label}</span>
                    </button>
                  );
                }}
              </For>
            </div>

            <Show when={filteredSortFields().length === 0}>
              <div class={sharedStyles.menuEmptyState}>Sin resultados</div>
            </Show>
          </div>
        </RecordIndexToolbarMenu>
      )}
    </Show>
  );
}

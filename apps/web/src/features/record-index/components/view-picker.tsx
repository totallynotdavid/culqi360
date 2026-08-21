import { For, Show, type Accessor } from "solid-js";

import { AnchoredPopover } from "~/components/ui/overlay/anchored-popover";

import { useRecordIndex } from "../context/record-index-context";

import sharedStyles from "../styles/menu.module.css";

export function RecordIndexViewPicker(props: {
  anchor: Accessor<HTMLButtonElement | undefined>;
}) {
  const recordIndex = useRecordIndex();
  const isOpen = () => recordIndex.columns.openMenu() === "views";

  return (
    <Show
      when={recordIndex.definition.views && isOpen() && props.anchor()}
      keyed
    >
      {(anchor) => (
        <AnchoredPopover
          id={`${recordIndex.definition.id}-view-picker`}
          anchor={anchor}
          class={`${sharedStyles.menu} ${sharedStyles.menuFloating} ${sharedStyles.menuLeft}`}
          onClose={() => recordIndex.columns.setOpenMenu(null)}
          variant="positioner"
        >
          <div role="dialog" aria-label="Seleccionar vista">
            <div class={sharedStyles.menuGroupLabel}>Vista</div>
            <div
              class={`${sharedStyles.menuScrollable} ${sharedStyles.menuScrollableCompact}`}
            >
              <div class={sharedStyles.menuListbox}>
                <For
                  each={recordIndex.definition.views?.catalog.available ?? []}
                >
                  {(view) => {
                    const isActive = () =>
                      recordIndex.view?.value() === view.id;
                    return (
                      <button
                        type="button"
                        class={sharedStyles.menuItem}
                        aria-pressed={isActive() ? "true" : "false"}
                        data-active={isActive() ? "true" : "false"}
                        onClick={() => {
                          recordIndex.view?.set(view.id);
                          recordIndex.columns.setOpenMenu(null);
                        }}
                      >
                        {view.label}
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>
        </AnchoredPopover>
      )}
    </Show>
  );
}

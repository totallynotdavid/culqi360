import { For } from "solid-js";

import { useRecordIndex } from "../../context/record-index-context";
import type { RecordIndexFilterField } from "../../model/catalog";
import { DropdownMenuHeader } from "./menu-primitives";

import sharedStyles from "../../styles/menu.module.css";

type FilterValueMenuProps = {
  field: RecordIndexFilterField;
  onClose: () => void;
};

export function FilterValueMenu(props: FilterValueMenuProps) {
  const recordIndex = useRecordIndex();
  const Icon = () => props.field.icon;

  return (
    <>
      <DropdownMenuHeader
        title="Configurar filtro"
        onClose={props.onClose}
        onBack={() => recordIndex.filtering?.setPanel({ kind: "field-list" })}
      />
      <div class={sharedStyles.menuScrollable}>
        <div class={sharedStyles.menuGroupLabel}>Valores</div>
        <div class={sharedStyles.menuListbox}>
          <For each={props.field.options}>
            {(option) => {
              const OptionIcon = Icon();
              return (
                <button
                  type="button"
                  class={sharedStyles.menuItem}
                  data-active={
                    recordIndex.filtering?.value() === option.value
                      ? "true"
                      : "false"
                  }
                  aria-pressed={
                    recordIndex.filtering?.value() === option.value
                      ? "true"
                      : "false"
                  }
                  onClick={() => {
                    recordIndex.filtering?.set(option.value);
                    recordIndex.filtering?.setPanel({ kind: "field-list" });
                    props.onClose();
                  }}
                >
                  <span class={sharedStyles.menuItemIcon}>
                    <OptionIcon size={16} />
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </>
  );
}

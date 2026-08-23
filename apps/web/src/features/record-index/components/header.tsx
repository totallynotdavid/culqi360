import { Show } from "solid-js";

import ChevronDown from "~/components/icons/chevron-down";
import List from "~/components/icons/list";

import { useRecordIndex } from "../context/record-index-context";
import { RecordIndexViewBar } from "./view-bar";
import { RecordIndexViewPicker } from "./view-picker";

import menuStyles from "../styles/menu.module.css";
import styles from "../styles/toolbar.module.css";

export function RecordIndexHeader() {
  const recordIndex = useRecordIndex();
  const PickerIcon = recordIndex.definition.pickerIcon ?? List;
  const viewPickerId = `${recordIndex.definition.id}-view-picker`;
  let picker: HTMLButtonElement | undefined;

  const pickerOnClick = recordIndex.definition.views
    ? () =>
        recordIndex.columns.setOpenMenu((current) =>
          current === "views" ? null : "views",
        )
    : undefined;

  return (
    <div class={styles.viewBar}>
      <div class={styles.viewBarTop}>
        <div class={menuStyles.menuWrap}>
          <button
            ref={(element) => (picker = element)}
            type="button"
            class={styles.viewPicker}
            aria-controls={
              recordIndex.definition.views ? viewPickerId : undefined
            }
            aria-expanded={
              recordIndex.definition.views
                ? recordIndex.columns.openMenu() === "views"
                  ? "true"
                  : "false"
                : undefined
            }
            aria-haspopup={recordIndex.definition.views ? "dialog" : undefined}
            onClick={pickerOnClick}
          >
            <span class={styles.viewPickerIcon}>
              <PickerIcon size={16} />
            </span>
            <span class={styles.viewPickerLabel}>
              {recordIndex.definition.title()}
            </span>
            <span class={styles.viewPickerMeta}>
              {`· ${recordIndex.counts.pickerMeta()}`}
              <Show when={recordIndex.definition.views}>
                <ChevronDown size={14} />
              </Show>
            </span>
          </button>
          <Show when={recordIndex.definition.views}>
            <RecordIndexViewPicker anchor={() => picker} />
          </Show>
        </div>
        <div class={styles.viewActions}>
          <RecordIndexViewBar />
        </div>
      </div>
    </div>
  );
}

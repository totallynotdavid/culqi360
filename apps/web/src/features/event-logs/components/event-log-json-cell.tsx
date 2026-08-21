import { createSignal, createUniqueId, Show } from "solid-js";

import { isTwoFirstDepths } from "~/components/ui/display/json-tree/is-two-first-depths";
import { JsonTree } from "~/components/ui/display/json-tree/json-tree";
import { AnchoredPopover } from "~/components/ui/overlay/anchored-popover";
import type { JsonObject } from "~/contracts/event-logs/event-log";

import styles from "./event-log-json-cell.module.css";

export function EventLogJsonCell(props: { value: JsonObject }) {
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [anchor, setAnchor] = createSignal<HTMLButtonElement>();
  const popoverId = createUniqueId();
  const isEmpty = () => Object.keys(props.value).length === 0;

  return (
    <Show when={!isEmpty()} fallback={<span class={styles.empty}>-</span>}>
      <button
        type="button"
        ref={setAnchor}
        class={styles.preview}
        aria-controls={popoverId}
        aria-expanded={isExpanded() ? "true" : "false"}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        {JSON.stringify(props.value)}
      </button>
      <Show when={isExpanded() && anchor()} keyed>
        {(currentAnchor) => (
          <AnchoredPopover
            id={popoverId}
            anchor={currentAnchor}
            onClose={() => setIsExpanded(false)}
          >
            <JsonTree
              value={props.value}
              shouldExpandNodeInitially={isTwoFirstDepths}
              emptyArrayLabel="Arreglo vacío"
              emptyObjectLabel="Objeto vacío"
              emptyStringLabel="[texto vacío]"
              onNodeValueClick={(text) =>
                void navigator.clipboard?.writeText(text)
              }
            />
          </AnchoredPopover>
        )}
      </Show>
    </Show>
  );
}

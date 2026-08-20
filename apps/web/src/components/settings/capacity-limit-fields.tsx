import type { StoreSetter } from "solid-js";

import { Input } from "~/components/ui/input/input";

import styles from "./capacity-limit-fields.module.css";

export interface CapacityLimitsDraft {
  searchLimit: string;
  bufferTarget: string;
  dailyRefillLimit: string;
}

export function CapacityLimitFields(props: {
  draft: CapacityLimitsDraft;
  setDraft: StoreSetter<CapacityLimitsDraft>;
  disabled?: boolean;
}) {
  return (
    <div class={styles.grid}>
      <Input
        type="number"
        label="Límite mensual de búsquedas"
        value={props.draft.searchLimit}
        onInput={(event) => {
          const searchLimit = event.currentTarget.value;
          props.setDraft((draft) => {
            draft.searchLimit = searchLimit;
          });
        }}
        disabled={props.disabled}
        required
      />
      <Input
        type="number"
        label="Límite de clientes activos"
        value={props.draft.bufferTarget}
        onInput={(event) => {
          const bufferTarget = event.currentTarget.value;
          props.setDraft((draft) => {
            draft.bufferTarget = bufferTarget;
          });
        }}
        disabled={props.disabled}
        required
      />
      <Input
        type="number"
        label="Límite diario de asignaciones"
        value={props.draft.dailyRefillLimit}
        onInput={(event) => {
          const dailyRefillLimit = event.currentTarget.value;
          props.setDraft((draft) => {
            draft.dailyRefillLimit = dailyRefillLimit;
          });
        }}
        disabled={props.disabled}
        required
      />
    </div>
  );
}

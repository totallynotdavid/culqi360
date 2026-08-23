import { For, Show } from "solid-js";

import type {
  DataGridActionRowConfig,
  DataGridColumn,
  DataGridRowOpenIndicator,
} from "../model/types";
import { DataGridActionRow } from "./action-row";
import { DataGridRow } from "./row";

export function DataGridBody<T>(props: {
  actionRow?: DataGridActionRowConfig;
  columns: ReadonlyArray<DataGridColumn<T>>;
  onRowOpen?: (row: T) => void;
  rowId: (row: T) => string;
  rowOpenIndicator?: DataGridRowOpenIndicator;
  rowIndexOffset: number;
  rows: ReadonlyArray<T>;
  stickyColumnIndex: number;
  totalRowCount: number;
}) {
  return (
    <>
      <For each={props.rows} keyed={props.rowId}>
        {(row, index) => (
          <DataGridRow
            columns={props.columns}
            onRowOpen={props.onRowOpen}
            row={row()}
            rowId={props.rowId}
            rowOpenIndicator={props.rowOpenIndicator}
            ariaRowIndex={props.rowIndexOffset + index() + 2}
            rowOrderIndex={index()}
            stickyColumnIndex={props.stickyColumnIndex}
          />
        )}
      </For>

      <Show when={props.actionRow}>
        {(action) => (
          <DataGridActionRow
            config={action()}
            ariaRowIndex={props.totalRowCount + 2}
            labelColumnIndex={Math.max(props.stickyColumnIndex, 0)}
            stickyColumnIndex={props.stickyColumnIndex}
          />
        )}
      </Show>
    </>
  );
}

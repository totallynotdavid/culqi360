import { For, Match, Show, Switch } from "solid-js";

import ChevronRight from "~/components/icons/chevron-right";
import LayoutSidebarRightCollapse from "~/components/icons/layout-sidebar-right-collapse";
import { Checkbox } from "~/components/ui/input/checkbox";

import { useDataGrid } from "../context/instance-context";
import type { DataGridColumn, DataGridRowOpenIndicator } from "../model/types";
import { DataGridCell } from "./cell";

import styles from "../styles/table.module.css";

export function DataGridRow<T>(props: {
  columns: ReadonlyArray<DataGridColumn<T>>;
  ariaRowIndex: number;
  onRowOpen?: (row: T) => void;
  rowId: (row: T) => string;
  rowOrderIndex: number;
  rowOpenIndicator?: DataGridRowOpenIndicator;
  row: T;
  stickyColumnIndex: number;
}) {
  const grid = useDataGrid();
  const rowKey = () => props.rowId(props.row);

  return (
    <div
      class={styles.bodyRow}
      data-grid-row-id={rowKey()}
      data-grid-row-index={props.rowOrderIndex}
      data-selectable-id={grid.selection ? rowKey() : undefined}
      aria-rowindex={props.ariaRowIndex}
      aria-selected={
        grid.selection
          ? grid.selection.isSelected(rowKey())
            ? "true"
            : "false"
          : undefined
      }
      data-active={grid.focus.isRowActive(rowKey()) ? "true" : "false"}
      data-dragged={grid.reorder?.isDragged(rowKey()) ? "true" : "false"}
      data-drop-target={grid.reorder?.isDropTarget(rowKey()) ? "true" : "false"}
      data-focused={grid.focus.isRowFocused(rowKey()) ? "true" : "false"}
      role="row"
    >
      <Show when={grid.reorder}>
        {(reorder) => (
          <div
            class={`${styles.bodyCell} ${styles.reorderCell}`}
            role="gridcell"
          >
            <button
              type="button"
              class={styles.reorderHandle}
              data-grid-reorder-handle="true"
              data-select-disable="true"
              aria-label="Reordenar fila"
              disabled={!grid.isInteractive()}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                reorder().begin({
                  rowId: rowKey(),
                  rowIndex: props.rowOrderIndex,
                  pointerId: event.pointerId,
                  clientY: event.clientY,
                });
              }}
            >
              <span class={styles.reorderDots} aria-hidden="true" />
            </button>
          </div>
        )}
      </Show>
      <Show when={grid.selection}>
        {(selection) => (
          <div
            class={`${styles.bodyCell} ${styles.checkboxCell}`}
            data-selection-cell="true"
            data-select-disable="true"
            role="gridcell"
          >
            <Checkbox
              aria-label="Seleccionar fila"
              checked={selection().isSelected(rowKey())}
              disabled={!grid.isInteractive()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) =>
                selection().setSelected(rowKey(), event.currentTarget.checked)
              }
            />
          </div>
        )}
      </Show>
      <For each={props.columns}>
        {(column, index) => (
          <DataGridRowCell
            column={column}
            onRowOpen={props.onRowOpen}
            row={props.row}
            rowId={props.rowId}
            rowOpenIndicator={props.rowOpenIndicator}
            sticky={index() === props.stickyColumnIndex}
          />
        )}
      </For>
    </div>
  );
}

function DataGridRowCell<T>(props: {
  column: DataGridColumn<T>;
  onRowOpen?: (row: T) => void;
  row: T;
  rowId: (row: T) => string;
  rowOpenIndicator?: DataGridRowOpenIndicator;
  sticky: boolean;
}) {
  const grid = useDataGrid();
  const rowKey = () => props.rowId(props.row);
  const editable = () => props.column.edit !== undefined;
  const activatable = () => editable() || props.onRowOpen !== undefined;
  const showOpenHint = () =>
    !editable() && props.onRowOpen !== undefined && props.sticky;

  function activateCell(anchor: HTMLElement) {
    if (grid.activation.suppressed()) {
      grid.activation.clearSuppression();
      return;
    }

    if (editable()) {
      grid.focus.openEditor(rowKey(), props.column.key, anchor);
      return;
    }

    if (props.onRowOpen) {
      grid.focus.activateRow(rowKey());
      props.onRowOpen(props.row);
    }
  }

  return (
    <DataGridCell
      sticky={props.sticky}
      role="gridcell"
      ref={(element) => {
        element.dataset.gridRowId = rowKey();
        element.dataset.gridColumnKey = props.column.key;
      }}
      data-grid-focusable-cell="true"
      tabindex={
        grid.isInteractive()
          ? grid.focus.getCellTabIndex(rowKey(), props.column.key)
          : -1
      }
      onClick={(event) => {
        if (
          !grid.isInteractive() ||
          !activatable() ||
          isNestedInteractiveTarget(event)
        ) {
          return;
        }

        activateCell(event.currentTarget);
      }}
      onFocus={() => grid.focus.focusCell(rowKey(), props.column.key)}
      onKeyDown={(event) => {
        grid.focus.handleCellKeyDown(event, rowKey(), props.column.key);
        if (
          !grid.isInteractive() ||
          !activatable() ||
          (event.key !== "Enter" && event.key !== " ")
        ) {
          return;
        }

        event.preventDefault();
        activateCell(event.currentTarget);
      }}
    >
      <div
        class={activatable() ? styles.rowButton : styles.rowContent}
        data-editable={editable() ? "true" : undefined}
      >
        <span class={styles.rowButtonContent}>
          <span class={styles.rowButtonLabel}>
            {props.column.renderCell(props.row)}
          </span>
          <Show when={showOpenHint() && props.rowOpenIndicator}>
            {(indicator) => <DataGridRowOpenHint mode={indicator()} />}
          </Show>
        </span>
      </div>
    </DataGridCell>
  );
}

function isNestedInteractiveTarget(
  event: MouseEvent & { currentTarget: Element },
) {
  const target = event.target;
  return (
    target instanceof Element &&
    target !== event.currentTarget &&
    target.closest("a, button, input, select, textarea, [role='button']") !==
      null
  );
}

function DataGridRowOpenHint(props: { mode: DataGridRowOpenIndicator }) {
  return (
    <Switch>
      <Match when={props.mode === "panel"}>
        <span class={styles.rowOpenHint} aria-hidden="true">
          <LayoutSidebarRightCollapse size={12} />
        </span>
      </Match>
      <Match when={props.mode === "route"}>
        <span class={styles.rowOpenHint} aria-hidden="true">
          <ChevronRight size={12} />
        </span>
      </Match>
    </Switch>
  );
}

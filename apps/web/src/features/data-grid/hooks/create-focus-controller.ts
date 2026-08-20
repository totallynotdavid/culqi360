import {
  createEffect,
  createMemo,
  createSignal,
  type Accessor,
} from "solid-js";

import { getVerticalNavigationAction } from "~/browser/keyboard/list-navigation";

export type DataGridCellAddress = {
  rowId: string;
  columnKey: string;
};

export type DataGridEditingCell = DataGridCellAddress & {
  anchor: HTMLElement;
};

export type DataGridFocusController = {
  editingCell: Accessor<DataGridEditingCell | undefined>;
  hasActiveRow: Accessor<boolean>;
  hasEditingCell: Accessor<boolean>;
  hasFocusedCell: Accessor<boolean>;
  activateRow: (rowId: string) => void;
  clearActiveRow: () => void;
  clearFocus: () => void;
  closeEditor: () => void;
  focusCell: (rowId: string, columnKey: string) => void;
  getCellTabIndex: (rowId: string, columnKey: string) => number;
  handleCellKeyDown: (
    event: KeyboardEvent,
    rowId: string,
    columnKey: string,
  ) => void;
  isCellEditing: (rowId: string, columnKey: string) => boolean;
  isRowActive: (rowId: string) => boolean;
  isRowFocused: (rowId: string) => boolean;
  openEditor: (rowId: string, columnKey: string, anchor: HTMLElement) => void;
};

export function createDataGridFocusController(options: {
  rowIds: Accessor<ReadonlyArray<string>>;
  columnKeys: Accessor<ReadonlyArray<string>>;
  getContainer: () => HTMLElement | undefined;
}): DataGridFocusController {
  const [activeRowId, setActiveRowId] = createSignal<string>();
  const [focusedCell, setFocusedCell] = createSignal<DataGridCellAddress>();
  const [editingCell, setEditingCell] = createSignal<DataGridEditingCell>();

  // Prunes focus, editing and active row whenever the grid's rows or columns
  // change under them. It reads the same signals it writes; the writes settle
  // because each guard only fires when the value is actually stale.
  createEffect(
    () => ({
      rowIds: options.rowIds(),
      columnKeys: options.columnKeys(),
      activeRow: activeRowId(),
      editing: editingCell(),
      focused: focusedCell(),
    }),
    ({ rowIds, columnKeys, activeRow, editing, focused }) => {
      if (activeRow && !rowIds.includes(activeRow)) {
        setActiveRowId(undefined);
      }

      if (
        editing &&
        (!rowIds.includes(editing.rowId) ||
          !columnKeys.includes(editing.columnKey))
      ) {
        setEditingCell(undefined);
      }

      if (rowIds.length === 0 || columnKeys.length === 0) {
        setFocusedCell(undefined);
        return;
      }

      const firstRowId = rowIds[0];
      const firstColumnKey = columnKeys[0];
      if (!firstRowId || !firstColumnKey) {
        return;
      }

      if (
        !focused ||
        !rowIds.includes(focused.rowId) ||
        !columnKeys.includes(focused.columnKey)
      ) {
        setFocusedCell({ rowId: firstRowId, columnKey: firstColumnKey });
      }
    },
  );

  function findCellElement(rowId: string, columnKey: string) {
    return Array.from(
      options
        .getContainer()
        ?.querySelectorAll<HTMLElement>("[data-grid-focusable-cell]") ?? [],
    ).find(
      (element) =>
        element.dataset.gridRowId === rowId &&
        element.dataset.gridColumnKey === columnKey,
    );
  }

  function focusCellElement(rowId: string, columnKey: string) {
    findCellElement(rowId, columnKey)?.focus();
  }

  function initialCell(): DataGridCellAddress | undefined {
    const rowId = options.rowIds()[0];
    const columnKey = options.columnKeys()[0];
    return rowId && columnKey ? { rowId, columnKey } : undefined;
  }

  return {
    editingCell,
    hasActiveRow: createMemo(() => activeRowId() !== undefined),
    hasEditingCell: createMemo(() => editingCell() !== undefined),
    hasFocusedCell: createMemo(() => focusedCell() !== undefined),
    activateRow: setActiveRowId,
    clearActiveRow: () => setActiveRowId(undefined),
    clearFocus: () => setFocusedCell(undefined),
    closeEditor() {
      const current = editingCell();
      setEditingCell(undefined);
      if (!current) {
        return;
      }

      if (current.anchor.isConnected) {
        current.anchor.focus();
        return;
      }

      focusCellElement(current.rowId, current.columnKey);
    },
    focusCell: (rowId, columnKey) => setFocusedCell({ rowId, columnKey }),
    getCellTabIndex(rowId, columnKey) {
      const current = focusedCell() ?? initialCell();
      return current?.rowId === rowId && current.columnKey === columnKey
        ? 0
        : -1;
    },
    handleCellKeyDown(event, rowId, columnKey) {
      const columnKeys = options.columnKeys();
      const columnIndex = columnKeys.indexOf(columnKey);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const nextIndex =
          event.key === "ArrowLeft"
            ? Math.max(0, columnIndex - 1)
            : Math.min(columnKeys.length - 1, columnIndex + 1);
        const nextColumnKey = columnKeys[nextIndex];
        if (!nextColumnKey || nextColumnKey === columnKey) {
          return;
        }

        event.preventDefault();
        setFocusedCell({ rowId, columnKey: nextColumnKey });
        focusCellElement(rowId, nextColumnKey);
        return;
      }

      const rowIds = options.rowIds();
      const currentIndex = rowIds.indexOf(rowId);
      const action = getVerticalNavigationAction(event.key, {
        currentIndex,
        itemCount: rowIds.length,
        includeHomeEnd: true,
      });
      if (!action || action.type !== "move") {
        return;
      }

      const nextRowId = rowIds[action.nextIndex];
      if (!nextRowId) {
        return;
      }

      event.preventDefault();
      setFocusedCell({ rowId: nextRowId, columnKey });
      focusCellElement(nextRowId, columnKey);
    },
    isCellEditing(rowId, columnKey) {
      const current = editingCell();
      return current?.rowId === rowId && current.columnKey === columnKey;
    },
    isRowActive: (rowId) => activeRowId() === rowId,
    isRowFocused: (rowId) => focusedCell()?.rowId === rowId,
    openEditor(rowId, columnKey, anchor) {
      setFocusedCell({ rowId, columnKey });
      setEditingCell({ rowId, columnKey, anchor });
    },
  };
}

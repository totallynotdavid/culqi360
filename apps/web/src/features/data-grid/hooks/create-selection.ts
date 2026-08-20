import { createEffect, createSignal, type Accessor } from "solid-js";

import type { DataGridSelectionController } from "../model/selection";

export function createDataGridSelection<T>(
  rows: Accessor<ReadonlyArray<T>>,
  rowId: (row: T) => string,
): DataGridSelectionController {
  const [selectedIds, setSelectedIds] = createSignal<ReadonlySet<string>>(
    new Set(),
  );

  const rowIds = () => new Set(rows().map(rowId));
  const allSelected = () =>
    rows().length > 0 && rows().every((row) => selectedIds().has(rowId(row)));

  const someSelected = () =>
    rows().some((row) => selectedIds().has(rowId(row))) && !allSelected();

  createEffect(rowIds, (validIds) => {
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return setsEqual(current, next) ? current : next;
    });
  });

  function setSelected(id: string, checked: boolean) {
    if (checked && !rowIds().has(id)) {
      return;
    }

    setSelectedIds((current) => {
      if (current.has(id) === checked) {
        return current;
      }

      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  function replace(ids: Iterable<string>) {
    const validIds = rowIds();
    const next = new Set([...ids].filter((id) => validIds.has(id)));
    setSelectedIds((current) => (setsEqual(current, next) ? current : next));
  }

  function toggleAll(checked: boolean) {
    replace(checked ? rows().map(rowId) : []);
  }

  function clear() {
    replace([]);
  }

  return {
    selectedIds,
    allSelected,
    someSelected,
    isSelected: (id) => selectedIds().has(id),
    clear,
    setSelected,
    replace,
    toggleAll,
  };
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

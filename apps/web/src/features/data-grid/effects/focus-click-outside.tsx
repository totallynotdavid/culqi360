import { onSettled } from "solid-js";

import { useDataGrid } from "../context/instance-context";

export function DataGridFocusClickOutsideEffect() {
  const grid = useDataGrid();
  const focus = grid.focus;

  const handlePointerDown = (event: PointerEvent) => {
    const container = grid.getContainer();
    const target = event.target;

    if (
      (!focus.hasFocusedCell() && !focus.hasActiveRow()) ||
      !container ||
      !(target instanceof Node) ||
      container.contains(target)
    ) {
      return;
    }

    focus.clearFocus();
    focus.clearActiveRow();
  };

  onSettled(() => {
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  });

  return null;
}

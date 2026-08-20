import { onSettled } from "solid-js";

import { useDataGrid } from "../context/instance-context";
import { autoScrollContainer, getRowIndexFromPointer } from "../dnd/geometry";
import type { DataGridReorderController } from "../hooks/create-reorder-controller";

const DRAG_REORDER_THRESHOLD = 4;

export function DataGridReorderEffect(props: {
  reorder: DataGridReorderController;
}) {
  const grid = useDataGrid();
  const reorderController = props.reorder;

  onSettled(() => {
    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== reorderController.pointerId()) {
        return;
      }

      const activeRowId = reorderController.activeRowId();
      const sourceIndex = reorderController.sourceIndex();
      const startY = reorderController.pointerStartY();

      if (
        activeRowId === undefined ||
        sourceIndex === undefined ||
        startY === undefined
      ) {
        return;
      }

      if (!reorderController.dragging()) {
        const distance = Math.abs(event.clientY - startY);
        if (distance < DRAG_REORDER_THRESHOLD) {
          return;
        }
      }

      reorderController.setDragging(true);
      grid.activation.suppress();

      autoScrollContainer(grid.getScrollWrapper(), event.clientY);

      const container = grid.getContainer();
      if (!container) {
        return;
      }

      const nextIndex = getRowIndexFromPointer(container, event.clientY);
      if (nextIndex !== undefined) {
        reorderController.setTargetIndex(nextIndex);
      }
    }

    function handlePointerUp(event: PointerEvent) {
      if (
        event.pointerId !== reorderController.pointerId() ||
        !reorderController.activeRowId()
      ) {
        return;
      }

      reorderController.complete();
      setTimeout(() => grid.activation.clearSuppression(), 0);
    }

    function handlePointerCancel(event: PointerEvent) {
      if (event.pointerId !== reorderController.pointerId()) {
        return;
      }

      reorderController.cancel();
      grid.activation.clearSuppression();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  });

  return null;
}

import { Portal } from "@solidjs/web";
import { createSignal, onSettled, Show } from "solid-js";

import { useDataGrid } from "../context/instance-context";
import {
  autoScrollContainer,
  createSelectionBox,
  getPointRelativeToContainer,
  getSelectableRowIdsInBox,
} from "../dnd/geometry";
import type { DataGridPoint, DataGridSelectionBox } from "../dnd/types";
import type { DataGridSelectionController } from "../model/selection";

import styles from "../styles/table.module.css";

const DRAG_SELECTION_THRESHOLD = 6;

export function DataGridDragSelectEffect(props: {
  selection: DataGridSelectionController;
}) {
  const grid = useDataGrid();
  const [selectionBox, setSelectionBox] = createSignal<
    DataGridSelectionBox | undefined
  >();
  const selectionController = props.selection;

  onSettled(() => {
    const scrollWrapper = grid.getScrollWrapper();
    if (!scrollWrapper) {
      return;
    }
    const scrollContainer = scrollWrapper;

    let pointerId: number | undefined;
    let startPoint: DataGridPoint | undefined;
    let latestClientPoint: DataGridPoint | undefined;
    let selecting = false;
    let animationFrame: number | undefined;

    function stopAnimationFrame() {
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
        animationFrame = undefined;
      }
    }

    function reset() {
      if (
        pointerId !== undefined &&
        scrollContainer.hasPointerCapture(pointerId)
      ) {
        scrollContainer.releasePointerCapture(pointerId);
      }

      stopAnimationFrame();
      pointerId = undefined;
      startPoint = undefined;
      latestClientPoint = undefined;
      selecting = false;
      setSelectionBox(undefined);
    }

    function updateSelection() {
      animationFrame = undefined;
      if (!selecting || !startPoint || !latestClientPoint) {
        return;
      }

      autoScrollContainer(scrollContainer, latestClientPoint.y);
      const nextPoint = getPointRelativeToContainer(
        scrollContainer,
        latestClientPoint.x,
        latestClientPoint.y,
      );
      const nextSelectionBox = createSelectionBox(startPoint, nextPoint);

      setSelectionBox(nextSelectionBox);
      selectionController.replace(
        getSelectableRowIdsInBox(scrollContainer, nextSelectionBox),
      );
      animationFrame = requestAnimationFrame(updateSelection);
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }

      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        !scrollContainer.contains(target) ||
        target.closest(
          "[data-select-disable='true'], [contenteditable='true'], a, button, input, select, textarea",
        )
      ) {
        return;
      }

      pointerId = event.pointerId;
      latestClientPoint = { x: event.clientX, y: event.clientY };
      startPoint = getPointRelativeToContainer(
        scrollContainer,
        event.clientX,
        event.clientY,
      );
      scrollContainer.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
      if (
        pointerId === undefined ||
        event.pointerId !== pointerId ||
        !startPoint
      ) {
        return;
      }

      latestClientPoint = { x: event.clientX, y: event.clientY };
      if (selecting) {
        event.preventDefault();
        return;
      }

      const nextPoint = getPointRelativeToContainer(
        scrollContainer,
        event.clientX,
        event.clientY,
      );
      const distance = Math.max(
        Math.abs(nextPoint.x - startPoint.x),
        Math.abs(nextPoint.y - startPoint.y),
      );
      if (distance < DRAG_SELECTION_THRESHOLD) {
        return;
      }

      selecting = true;
      selectionController.clear();
      grid.activation.suppress();
      animationFrame = requestAnimationFrame(updateSelection);
    }

    function handlePointerUp(event: PointerEvent) {
      if (pointerId === undefined || event.pointerId !== pointerId) {
        return;
      }

      const wasSelecting = selecting;
      reset();
      if (wasSelecting) {
        setTimeout(() => grid.activation.clearSuppression(), 0);
      }
    }

    function handlePointerCancel(event: PointerEvent) {
      if (pointerId === undefined || event.pointerId !== pointerId) {
        return;
      }

      reset();
      grid.activation.clearSuppression();
    }

    scrollContainer.addEventListener("pointerdown", handlePointerDown);
    scrollContainer.addEventListener("pointermove", handlePointerMove);
    scrollContainer.addEventListener("pointerup", handlePointerUp);
    scrollContainer.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      reset();
      scrollContainer.removeEventListener("pointerdown", handlePointerDown);
      scrollContainer.removeEventListener("pointermove", handlePointerMove);
      scrollContainer.removeEventListener("pointerup", handlePointerUp);
      scrollContainer.removeEventListener("pointercancel", handlePointerCancel);
    };
  });

  const overlayMount = () => grid.getScrollWrapper();

  return (
    <Show when={overlayMount() && selectionBox()}>
      {(currentSelectionBox) => (
        <Portal mount={overlayMount()}>
          <div
            class={styles.dragSelectionBox}
            aria-hidden="true"
            style={{
              top: `${currentSelectionBox().top}px`,
              left: `${currentSelectionBox().left}px`,
              width: `${currentSelectionBox().width}px`,
              height: `${currentSelectionBox().height}px`,
            }}
          />
        </Portal>
      )}
    </Show>
  );
}

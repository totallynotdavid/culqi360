import { isServer } from "@solidjs/web";
import { onCleanup } from "solid-js";

type ResizablePanelSide = "left" | "right";

type ResizablePanelConstraints = {
  min: number;
  max: number;
};

type UseResizablePanelProps = {
  side: ResizablePanelSide;
  constraints: ResizablePanelConstraints;
  getCurrentWidth: () => number;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  cssVariableName?: string;
  dragThresholdPx?: number;
};

type PointerDownHandler = (event: PointerEvent) => void;

function clampWidth(width: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, width));
}

export function useResizablePanel(
  props: UseResizablePanelProps,
): PointerDownHandler {
  const canUseDom = !isServer && typeof document !== "undefined";

  if (!canUseDom) {
    return () => {};
  }

  let startX = 0;
  let startWidth = 0;
  let isResizing = false;
  let hasDragged = false;

  const dragThresholdPx = props.dragThresholdPx ?? 5;

  const handlePointerMove = (event: PointerEvent): void => {
    if (!isResizing) {
      return;
    }

    const deltaX = event.clientX - startX;

    if (!hasDragged && Math.abs(deltaX) > dragThresholdPx) {
      hasDragged = true;
      props.onResizeStart?.();
    }

    if (Math.abs(deltaX) <= dragThresholdPx) {
      return;
    }

    const widthDelta = props.side === "right" ? deltaX : -deltaX;
    const nextWidth = clampWidth(
      startWidth + widthDelta,
      props.constraints.min,
      props.constraints.max,
    );

    if (props.cssVariableName) {
      document.documentElement.style.setProperty(
        props.cssVariableName,
        `${nextWidth}px`,
      );
    }
  };

  const handlePointerUp = (event: PointerEvent): void => {
    if (!isResizing) {
      return;
    }

    isResizing = false;
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
    props.onResizeEnd?.();

    const deltaX = event.clientX - startX;

    if (!hasDragged) {
      props.onCollapse();
      return;
    }

    const widthDelta = props.side === "right" ? deltaX : -deltaX;
    const finalWidth = clampWidth(
      startWidth + widthDelta,
      props.constraints.min,
      props.constraints.max,
    );
    props.onWidthChange(finalWidth);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    event.preventDefault();

    startX = event.clientX;
    startWidth = props.getCurrentWidth();
    isResizing = true;
    hasDragged = false;

    if (event.currentTarget instanceof Element) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  onCleanup(() => {
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
  });

  return onPointerDown;
}

import {
  MotionValue,
  cancelFrame,
  frame,
  interpolate,
  resize,
} from "motion-dom";
import { createEffect, onCleanup, type Accessor } from "solid-js";

/**
 * Progress endpoints as `[target, container]` normalized coordinates.
 * `[0, 0]` starts when both elements start, and `[1, 1]` ends when both end.
 */
export type ScrollOffset = readonly [
  start: readonly [target: number, container: number],
  end: readonly [target: number, container: number],
];

const defaultOffset: ScrollOffset = [
  [0, 0],
  [1, 1],
];

export interface ScrollOptions {
  /**
   * The element that scrolls. Defaults to the document's scrolling element.
   * Use an accessor so a ref callback can provide the element after mount.
   */
  container?: Accessor<HTMLElement | undefined>;
  /** The element to track. Defaults to the container. */
  target?: Accessor<HTMLElement | undefined>;
  offset?: ScrollOffset;
}

export interface ScrollValues {
  scrollX: MotionValue<number>;
  scrollY: MotionValue<number>;
  scrollXProgress: MotionValue<number>;
  scrollYProgress: MotionValue<number>;
}

/**
 * Creates MotionValues for scroll position and normalized progress.
 * Measurements update on scroll, resize, and target or container changes.
 * The returned values are destroyed with their owning scope.
 */
export function createScroll(options: ScrollOptions = {}): ScrollValues {
  const scrollX = new MotionValue(0);
  const scrollY = new MotionValue(0);
  const scrollXProgress = new MotionValue(0);
  const scrollYProgress = new MotionValue(0);
  onCleanup(() => {
    scrollX.destroy();
    scrollY.destroy();
    scrollXProgress.destroy();
    scrollYProgress.destroy();
  });

  const offset = options.offset ?? defaultOffset;

  createEffect(
    () => {
      const container = options.container
        ? options.container()
        : defaultScrollContainer();
      if (!container) return undefined;

      const target = options.target ? options.target() : container;
      if (!target) return undefined;

      return { container, target };
    },
    (spec) =>
      spec &&
      trackScroll(spec.container, spec.target, offset, (x, y) => {
        scrollX.set(x.current);
        scrollXProgress.set(x.progress);
        scrollY.set(y.current);
        scrollYProgress.set(y.progress);
      }),
  );

  return { scrollX, scrollY, scrollXProgress, scrollYProgress };
}

/** Use documentElement when jsdom does not expose document.scrollingElement. */
function defaultScrollContainer(): HTMLElement | undefined {
  return (document.scrollingElement ?? document.documentElement) as
    | HTMLElement
    | undefined;
}

interface AxisReading {
  current: number;
  progress: number;
}

function trackScroll(
  container: HTMLElement,
  target: HTMLElement,
  offset: ScrollOffset,
  onMeasure: (x: AxisReading, y: AxisReading) => void,
): VoidFunction {
  const measure = () =>
    onMeasure(
      measureAxis(container, target, "x", offset),
      measureAxis(container, target, "y", offset),
    );
  const scheduleMeasure = () => frame.read(measure);

  // Page scroll events go to window; element scroll events go to the container.
  const isRootContainer = container === defaultScrollContainer();
  const scrollTarget: EventTarget = isRootContainer ? window : container;
  scrollTarget.addEventListener("scroll", scheduleMeasure, {
    passive: true,
  });

  window.addEventListener("resize", scheduleMeasure);
  // Window resize covers the root; other containers can resize during reflow.
  const stopResize = isRootContainer
    ? undefined
    : resize(container, scheduleMeasure);

  measure();

  return () => {
    scrollTarget.removeEventListener("scroll", scheduleMeasure);
    window.removeEventListener("resize", scheduleMeasure);
    stopResize?.();
    // A queued measurement must not update the destroyed values.
    cancelFrame(measure);
  };
}

function measureAxis(
  container: HTMLElement,
  target: HTMLElement,
  axis: "x" | "y",
  offset: ScrollOffset,
): AxisReading {
  const isY = axis === "y";

  // Normalize negative scrollLeft values reported by some RTL browsers.
  const current = Math.abs(isY ? container.scrollTop : container.scrollLeft);
  const containerLength = isY ? container.clientHeight : container.clientWidth;

  const isSelf = target === container;
  const targetLength = isSelf
    ? isY
      ? container.scrollHeight
      : container.scrollWidth
    : isY
      ? target.clientHeight
      : target.clientWidth;
  const inset = isSelf ? 0 : axisInset(target, container, axis);

  const points = offset.map(
    ([targetPoint, containerPoint]) =>
      inset + targetPoint * targetLength - containerPoint * containerLength,
  );

  const progress = interpolate(points, [0, 1], { clamp: true })(current);
  return { current, progress };
}

/**
 * Returns the target's offset from the container along one axis.
 * The container must establish an offset-parent boundary for nested targets.
 */
function axisInset(
  target: HTMLElement,
  container: HTMLElement,
  axis: "x" | "y",
): number {
  let inset = 0;
  let node: HTMLElement | null = target;
  while (node && node !== container) {
    inset += axis === "y" ? node.offsetTop : node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return inset;
}

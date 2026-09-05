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
  /**
   * Frame-polls the container's scrollWidth/scrollHeight to catch content
   * growing the scrollable range without the container's own box resizing
   * (rows appending, images finishing load). ResizeObserver only fires on
   * the container's border box, so it misses this. Off by default: a
   * per-frame read is not free while tracking is active.
   */
  trackContentSize?: boolean;
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
  const trackContentSize = options.trackContentSize ?? false;

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
      trackScroll(
        spec.container,
        spec.target,
        offset,
        trackContentSize,
        (x, y) => {
          scrollX.set(x.current);
          scrollXProgress.set(x.progress);
          scrollY.set(y.current);
          scrollYProgress.set(y.progress);
        },
      ),
  );

  return { scrollX, scrollY, scrollXProgress, scrollYProgress };
}

/**
 * Use documentElement when jsdom does not expose document.scrollingElement.
 * Returns undefined outside a browser (SSR) instead of touching `document`.
 */
function defaultScrollContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
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
  trackContentSize: boolean,
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
  const stopContainerResize = isRootContainer
    ? undefined
    : resize(container, scheduleMeasure);
  // The target's own box can change independently of the container's (an
  // accordion expanding, an image finishing load), so it needs its own
  // observer whenever it isn't the container itself.
  const stopTargetResize =
    target === container ? undefined : resize(target, scheduleMeasure);
  const stopContentSizePoll = trackContentSize
    ? pollContentSize(container, scheduleMeasure)
    : undefined;

  measure();

  return () => {
    scrollTarget.removeEventListener("scroll", scheduleMeasure);
    window.removeEventListener("resize", scheduleMeasure);
    stopContainerResize?.();
    stopTargetResize?.();
    stopContentSizePoll?.();
    // A queued measurement must not update the destroyed values.
    cancelFrame(measure);
  };
}

/**
 * ResizeObserver only fires on the container's border box, not its scrollable
 * content size, so a fixed-height container whose rows or images load in
 * (growing scrollHeight/scrollWidth without resizing the container) never
 * triggers a remeasure. Frame-polling is the same tradeoff Framer Motion's
 * `trackContentSize` makes: content growth doesn't fire resize, so a resize
 * observer can't catch it, and comparing every frame is the exposed opt-in
 * rather than the default.
 */
function pollContentSize(
  container: HTMLElement,
  onContentResize: VoidFunction,
): VoidFunction {
  let width = container.scrollWidth;
  let height = container.scrollHeight;

  const checkContentSize = () => {
    const nextWidth = container.scrollWidth;
    const nextHeight = container.scrollHeight;
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    onContentResize();
  };

  frame.read(checkContentSize, true);
  return () => cancelFrame(checkContentSize);
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
 * Returns the target's offset from the container's padding box (the origin
 * scrollTop/scrollLeft and clientHeight/clientWidth measure from) along one
 * axis.
 *
 * Summing each element's own offsetParent chain independently and
 * subtracting gives the target-to-container distance regardless of which
 * ancestors are positioned, since both chains bottom out at the same
 * document origin. Where that difference lands depends on whether
 * `container` is itself one of `target`'s offsetParents:
 *
 * - If it is (container is a positioned scroll container, the common case),
 *   the walk already passes through container's own offsetTop/offsetLeft
 *   hop, which the CSSOM View spec defines as measured from container's
 *   padding box. The raw difference already lands on the padding-box
 *   origin, so no correction is needed. Subtracting clientTop/clientLeft
 *   here would over-correct by a full border width in the wrong direction.
 * - If it isn't (container is `position: static`, so every element's
 *   offsetParent walk skips over it), the chains only meet at container's
 *   own offsetParent, and the difference lands on container's border-box
 *   origin instead: container's own border-box-to-padding-box hop is
 *   missing from the sum. clientTop/clientLeft equal container's border
 *   width regardless of its `position`, so subtracting them converts to
 *   the padding-box origin.
 */
function axisInset(
  target: HTMLElement,
  container: HTMLElement,
  axis: "x" | "y",
): number {
  const rawInset =
    offsetFromDocument(target, axis) - offsetFromDocument(container, axis);
  if (isOffsetAncestor(container, target)) return rawInset;

  const containerBorder =
    axis === "y" ? container.clientTop : container.clientLeft;
  return rawInset - containerBorder;
}

/** Whether `container` is reachable by repeatedly walking `target.offsetParent`. */
function isOffsetAncestor(
  container: HTMLElement,
  target: HTMLElement,
): boolean {
  let node = target.offsetParent as HTMLElement | null;
  while (node) {
    if (node === container) return true;
    node = node.offsetParent as HTMLElement | null;
  }
  return false;
}

function offsetFromDocument(element: HTMLElement, axis: "x" | "y"): number {
  let offset = 0;
  let node: HTMLElement | null = element;
  while (node) {
    offset += axis === "y" ? node.offsetTop : node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return offset;
}

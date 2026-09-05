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
 * Returns target's border-box offset from container's padding-box origin
 * along one axis - the coordinate scrollTop/scrollLeft and
 * clientHeight/clientWidth measure from.
 *
 * Walking a single offsetParent chain from target and stopping at container
 * breaks whenever container is `position: static`: a static element is
 * never anyone's offsetParent, so the walk skips straight past it and lands
 * on whatever positioned ancestor sits above it instead (or the document
 * root), measuring against the wrong origin entirely. This is a known gap
 * in upstream Framer Motion's own implementation, which only warns about it
 * in dev rather than handling it. Measuring each element's own offset from
 * the document independently and subtracting sidesteps that: both walks
 * bottom out at the same root regardless of which ancestors are
 * positioned, so the difference is the target-to-container distance
 * whether or not container itself qualifies as an offsetParent.
 *
 * `offsetTop`/`offsetLeft` measure from the offsetParent's *padding* edge,
 * not its border edge, so every hop after the first still needs that
 * ancestor's own border added back to reconstruct a true
 * border-edge-to-border-edge distance; otherwise each intermediate
 * positioned ancestor's border silently disappears from a multi-hop chain.
 * The final subtraction of container's own border converts the result from
 * border-edge-relative to container's actual padding-box origin.
 *
 * This measurement is intentionally blind to CSS transforms on any element
 * between target and container (or on container/target themselves): a
 * `transform: translate/scale/rotate` never moves offsetTop/offsetLeft, only
 * where the box paints. The alternative - measuring via
 * `getBoundingClientRect()` - reflects transforms but reintroduces the exact
 * scroll-dependence bug this design replaced (a scrolled target's rect moves
 * with the container's own scrollTop, corrupting the fixed reference point
 * `measureAxis` needs). The same trade-off applies to a target nested inside
 * a `position: fixed` ancestor while container isn't: the two independent
 * walks below can bottom out at different reference frames (a fixed
 * element's offsetParent is null per spec) and the subtraction stops being
 * meaningful. Upstream Framer Motion's actual production implementation
 * (`resolveOffsets`/`calcInset` in framer-motion's offsets/inset.ts) has both
 * of the same limitations - it is also pure offsetTop/offsetParent based -
 * and its own test suite only asserts that a dev warning fires for a static
 * container, never that the resulting value is correct in that case. Given
 * that, and that this measurement already fixes two concrete regressions
 * upstream's real implementation still has (intermediate-ancestor border
 * drop, and position: static containers being silently measured from the
 * wrong origin instead of just warned about), this trade-off is accepted
 * rather than chased further.
 */
function axisInset(
  target: HTMLElement,
  container: HTMLElement,
  axis: "x" | "y",
): number {
  const containerBorder =
    axis === "y" ? container.clientTop : container.clientLeft;
  return (
    offsetFromDocument(target, axis) -
    offsetFromDocument(container, axis) -
    containerBorder
  );
}

function offsetFromDocument(element: HTMLElement, axis: "x" | "y"): number {
  let offset = 0;
  let node: HTMLElement | null = element;
  while (node) {
    offset += axis === "y" ? node.offsetTop : node.offsetLeft;
    if (node !== element) {
      offset += axis === "y" ? node.clientTop : node.clientLeft;
    }
    node = node.offsetParent as HTMLElement | null;
  }
  return offset;
}

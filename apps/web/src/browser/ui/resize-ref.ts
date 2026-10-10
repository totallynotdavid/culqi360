import { createEffect, createSignal } from "solid-js";

/**
 * Returns a `ref` callback that reports the latest size of its element. Call
 * it in a component body so the observer is disconnected with the component.
 * Solid runs refs with no owner, so the ref only stores the element and the
 * effect observes it. `ssrSource: "client"` keeps hydration ids aligned.
 */
export function createResizeRef(
  onResize: (entry: ResizeObserverEntry) => void,
): (element: Element) => void {
  const [element, setElement] = createSignal<Element>();

  createEffect(
    element,
    (target) => {
      if (!target) {
        return;
      }

      const observer = new ResizeObserver((entries) => {
        const latest = entries.at(-1);
        if (latest) {
          onResize(latest);
        }
      });

      observer.observe(target);

      return () => observer.disconnect();
    },
    { ssrSource: "client" },
  );

  return setElement;
}

/** Border box size, matching `getBoundingClientRect()` without transforms. */
export function borderBoxSize(entry: ResizeObserverEntry): {
  width: number;
  height: number;
} {
  const [box] = entry.borderBoxSize;
  if (!box) {
    return { width: entry.contentRect.width, height: entry.contentRect.height };
  }

  return { width: box.inlineSize, height: box.blockSize };
}

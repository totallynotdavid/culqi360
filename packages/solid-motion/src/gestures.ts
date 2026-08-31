import { addDomEvent, hover, press } from "motion-dom";
import { createEffect, createSignal, type Accessor } from "solid-js";

import type { AnimationDefinition } from "./types";

/**
 * The slice of the motion options this module reads. Narrower than the whole
 * options object on purpose: nothing here depends on the variant map, so
 * nothing here has to be generic over its custom data.
 */
export type GestureOptions = Partial<
  Record<GestureName, AnimationDefinition>
> & { viewport?: ViewportOptions };

/**
 * The gesture states an element can be in, lowest priority first. `animate`
 * sits below all of them and `exit` above, matching Motion's own order.
 */
export const gestureNames = [
  "whileInView",
  "whileFocus",
  "whileHover",
  "whilePress",
] as const;

export type GestureName = (typeof gestureNames)[number];

export interface ViewportOptions {
  /** Stay in the in-view state once entered, and stop observing. */
  once?: boolean;
  root?: Element | Document;
  /** Grows or shrinks the detection box, in CSS margin syntax. */
  margin?: string;
  /** How much of the element must be visible to count. */
  amount?: "some" | "all" | number;
}

/**
 * Starts watching one gesture and returns the disposer the owning scope needs.
 *
 * Hover and press come from motion-dom rather than from `pointerenter` and
 * `pointerdown` listeners written here. They are not thin wrappers: hover
 * filters polyfilled touch events, defers its end while a press is in flight so
 * a button does not flicker when the pointer slips off mid-click, and backs off
 * while a drag is active. Press filters secondary and multi-touch pointers,
 * ends on the capture phase so a child calling `stopPropagation` cannot strand
 * it, and drives the same gesture from Enter keydown/keyup for keyboards.
 */
function observeGesture(
  name: GestureName,
  element: HTMLElement | SVGElement,
  setActive: (active: boolean) => void,
  viewport?: ViewportOptions,
): VoidFunction {
  if (name === "whileInView") {
    return observeInView(element, setActive, viewport);
  }

  if (name === "whileHover") {
    return hover(element, () => {
      setActive(true);
      return () => setActive(false);
    });
  }

  if (name === "whilePress") {
    return press(element, () => {
      setActive(true);
      return () => setActive(false);
    });
  }

  return observeFocus(element, setActive);
}

const visibilityThresholds = { some: 0, all: 1 } as const;

/**
 * Viewport visibility, the one gesture motion-dom does not offer: `inView`
 * lives in framer-motion, and depending on that package to reach it would drag
 * back the animation engine wrapper we deliberately left behind.
 *
 * `once` unobserves on entry rather than checking a flag on every callback, so
 * a list that has finished revealing stops costing anything.
 */
function observeInView(
  element: HTMLElement | SVGElement,
  setActive: (active: boolean) => void,
  { once = false, root, margin, amount = "some" }: ViewportOptions = {},
): VoidFunction {
  if (typeof IntersectionObserver === "undefined") return () => undefined;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActive(true);
          if (once) observer.unobserve(entry.target);
        } else if (!once) {
          setActive(false);
        }
      }
    },
    {
      root,
      rootMargin: margin,
      threshold:
        typeof amount === "number" ? amount : visibilityThresholds[amount],
    },
  );

  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * Whether an element is in the viewport, as a plain accessor.
 *
 * The same observer `whileInView` runs on, without an animation attached. It is
 * exposed because the package already computes this, and the alternative is an
 * app reaching for a second IntersectionObserver library to answer a question
 * this one is already asking: a fetch-more sentinel, a lazily mounted chart, an
 * analytics impression.
 *
 * The node arrives through an accessor because a ref callback fires after the
 * effect would first run, and a plain variable is invisible to it.
 */
export function createInView(
  element: Accessor<HTMLElement | SVGElement | undefined>,
  viewport?: ViewportOptions,
): Accessor<boolean> {
  const [inView, setInView] = createSignal(false);

  createEffect(
    () => element(),
    (node) => (node ? observeInView(node, setInView, viewport) : undefined),
  );

  return inView;
}

/**
 * Focus only counts when the browser would have drawn a focus ring. Activating
 * on every `focus` would light the element up on a plain mouse click, which is
 * not what a focus style means.
 *
 * A browser without `:focus-visible` throws on the selector and draws its
 * default outline for all focus, so treating the throw as visible keeps the
 * animation consistent with what that browser paints.
 */
function observeFocus(
  element: HTMLElement | SVGElement,
  setActive: (active: boolean) => void,
): VoidFunction {
  const onFocus = () => {
    let isFocusVisible: boolean;
    try {
      isFocusVisible = element.matches(":focus-visible");
    } catch {
      isFocusVisible = true;
    }
    if (isFocusVisible) setActive(true);
  };

  const removeFocus = addDomEvent(element, "focus", onFocus);
  const removeBlur = addDomEvent(element, "blur", () => setActive(false));

  return () => {
    removeFocus();
    removeBlur();
  };
}

/**
 * One signal per gesture, with listeners attached only while the matching prop
 * exists, so an element without `whileHover` pays for no pointer listeners.
 *
 * The node arrives through a signal rather than a `let`, because an effect
 * cannot observe a plain variable being assigned by a ref callback.
 */
export function watchGestures(
  options: () => GestureOptions,
  element: Accessor<HTMLElement | SVGElement | undefined>,
): Record<GestureName, Accessor<boolean>> {
  const states = {} as Record<GestureName, Accessor<boolean>>;

  for (const name of gestureNames) {
    const [active, setActive] = createSignal(false);
    states[name] = active;

    createEffect(
      () => {
        if (options()[name] === undefined) return undefined;
        const node = element();
        if (!node) return undefined;
        // Re-read the viewport options here so changing them re-observes
        // instead of leaving a stale IntersectionObserver in place.
        return { node, viewport: options().viewport };
      },
      (spec) =>
        spec
          ? observeGesture(name, spec.node, setActive, spec.viewport)
          : undefined,
    );
  }

  return states;
}

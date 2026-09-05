import { MotionValue, attachFollow, isMotionValue } from "motion-dom";
import { createEffect, onCleanup, untrack } from "solid-js";

import type { MotionStyle, MotionStyleValue, Transition } from "./types";

/** Whatever drives a motion value: a constant, a Solid accessor, or another value. */
export type MotionSource<T> = T | (() => T) | MotionValue<T>;

/**
 * A value that lives outside Solid's render path: writes go straight to the
 * element on the animation frame, so nothing re-renders when it moves.
 *
 * The source can be a Solid accessor, which is the whole point of having this
 * rather than motion's `motionValue`. Motion needs a `MotionValue` to exist at
 * all because React has no way to observe a plain variable; here the signal
 * already is the source, and this only carries it across to the frame loop.
 *
 * With a `transition` the value does not jump to its source, it animates there,
 * springing by default. That is Motion's `useSpring`: `stiffness` and `damping`
 * describe the physics, and every change to the source retargets the spring
 * from its current position and velocity rather than restarting it.
 *
 * Destroyed with the scope that created it, so a component unmounting takes its
 * subscriptions with it.
 */
export function createMotionValue<T extends string | number>(
  source: MotionSource<T>,
  transition?: Transition,
): MotionValue<T> {
  const value = new MotionValue(untrack(() => read(source)));
  onCleanup(() => value.destroy());

  if (isMotionValue(source)) {
    // Not part of Solid's graph, so it needs motion's own subscription. With a
    // transition `attachFollow` installs that subscription itself.
    onCleanup(
      transition
        ? attachFollow(value, source, transition)
        : source.on("change", (latest: T) => value.set(latest)),
    );
    return value;
  }

  // `attachFollow` intercepts every later `set`, so an accessor driving the
  // value through an effect springs rather than jumps without knowing it.
  if (transition) attachFollow(value, value.get(), transition);
  if (typeof source === "function") {
    createEffect(source as () => T, (latest) => value.set(latest));
  }

  return value;
}

function read<T extends string | number>(source: MotionSource<T>): T {
  if (typeof source === "function") return source();
  // `isMotionValue` is not parameterised, so it narrows what the guard returns
  // but not the union's own `MotionValue<T>` member.
  if (isMotionValue(source)) return source.get() as T;
  return source as T;
}

/**
 * A style entry motion writes itself rather than handing to the DOM: either a
 * value the caller holds, or a Solid accessor to carry across for them.
 */
export function isMotionStyleValue(entry: unknown): entry is MotionStyleValue {
  return typeof entry === "function" || isMotionValue(entry);
}

/** The entries of a style the DOM owns, with everything motion drives removed. */
export function plainStyle(
  style: MotionStyle | undefined,
): Record<string, unknown> {
  if (!style) return {};

  const plain: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(style)) {
    if (!isMotionStyleValue(entry)) plain[key] = entry;
  }
  return plain;
}

export interface BoundStyle {
  /** Keyed by style property, for the value store to bind. */
  values: Map<string, MotionValue>;
  /**
   * What those values read at first render.
   *
   * Binding a populated value does not repaint on its own: motion records it in
   * the shared style state but only schedules the composite render when the
   * value next *changes*, so a transform bound at `x: 50` leaves
   * `transform: none` on screen until something moves. Rendering these into the
   * inline style closes that window, and costs nothing extra since the element
   * is already born carrying its initial style.
   */
  painted: Record<string, string | number>;
}

/**
 * Separates the style entries motion owns from the plain CSS the DOM owns.
 *
 * Read once rather than tracked. Which keys motion drives describes the element,
 * like `initial` does, and swapping a key from CSS to a value mid-life would
 * mean unbinding and rebinding the shared transform composite. An accessor
 * covers the case that actually comes up, which is the value changing.
 */
export function readStyleValues(style: MotionStyle | undefined): BoundStyle {
  const values = new Map<string, MotionValue>();
  const painted: Record<string, string | number> = {};
  if (!style) return { values, painted };

  for (const [key, entry] of Object.entries(style)) {
    if (!isMotionStyleValue(entry)) continue;

    const value = isMotionValue(entry)
      ? entry
      : createMotionValue(entry as () => string | number);

    values.set(key, value);
    painted[key] = value.get() as string | number;
  }

  return { values, painted };
}

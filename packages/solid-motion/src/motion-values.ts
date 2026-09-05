import {
  MotionValue,
  attachFollow,
  cancelFrame,
  frame,
  isMotionValue,
  type FrameData,
} from "motion-dom";
import { createEffect, onCleanup, untrack } from "solid-js";

import type { MotionStyle, MotionStyleValue, Transition } from "./types";

export type MotionSource<T> = T | (() => T) | MotionValue<T>;

/**
 * Creates a MotionValue from a literal, Solid accessor, or MotionValue.
 *
 * Solid accessors bridge into motion through an effect: the signal stays the
 * source of truth, and every change calls `set`. Those writes bypass Solid's
 * render path entirely, going straight to the element on the frame loop, so
 * nothing re-renders when the value moves. With a `transition`, a change does
 * not jump to the new value, it retargets the spring: `attachFollow`
 * intercepts `set` and animates from the value's current position and
 * velocity rather than restarting it. Cleanup follows the owner, so a
 * component unmounting destroys the value and tears down its subscriptions
 * with it.
 */
export function createMotionValue<T extends string | number>(
  source: MotionSource<T>,
  transition?: Transition,
): MotionValue<T> {
  const value = new MotionValue(untrack(() => read(source)));
  onCleanup(() => value.destroy());

  if (isMotionValue(source)) {
    // MotionValue sources are outside Solid's graph, so subscribe directly.
    // attachFollow handles the subscription when a transition is requested.
    onCleanup(
      transition
        ? attachFollow(value, source, transition)
        : source.on("change", (latest: T) => value.set(latest)),
    );
    return value;
  }

  // Accessor updates call set, so attach the transition before creating the effect.
  if (transition) attachFollow(value, value.get(), transition);
  if (typeof source === "function") {
    createEffect(source as () => T, (latest) => value.set(latest));
  }

  return value;
}

/** Tracks a source's velocity and decays it after the source stops changing. */
export function createVelocity(
  source: MotionValue<number>,
): MotionValue<number> {
  const velocity = new MotionValue(source.getVelocity());
  onCleanup(() => velocity.destroy());

  const sample = () => {
    const latest = source.getVelocity();
    velocity.set(latest);
    if (latest) frame.update(sample);
  };

  onCleanup(source.on("change", () => frame.update(sample, false, true)));
  // A sample queued before disposal must not update the destroyed value.
  onCleanup(() => cancelFrame(sample));

  return velocity;
}

/** Tracks elapsed milliseconds using the frame loop's shared clock. */
export function createTime(): MotionValue<number> {
  const value = new MotionValue(0);
  onCleanup(() => value.destroy());

  let start: number | undefined;
  const tick = ({ timestamp }: FrameData) => {
    start ??= timestamp;
    value.set(timestamp - start);
  };

  frame.update(tick, true);
  onCleanup(() => cancelFrame(tick));

  return value;
}

function read<T extends string | number>(source: MotionSource<T>): T {
  if (typeof source === "function") return source();
  // The unparameterized guard needs a cast back to MotionValue<T>.
  if (isMotionValue(source)) return source.get() as T;
  return source as T;
}

export function isMotionStyleValue(entry: unknown): entry is MotionStyleValue {
  return typeof entry === "function" || isMotionValue(entry);
}

/**
 * The entries of a style the DOM owns, with everything motion drives removed.
 *
 * Motion-driven entries are bound to the element already, so the DOM has no use
 * for them. Nothing observable goes wrong if they slip through, which is why no
 * test pins this: `motion.style` covers every bound key, and the ones it
 * renames (`x` to `transform`) leave behind a property name the CSS parser
 * drops anyway. It stays because handing `setProperty` a function or a
 * `MotionValue` is wrong on its face, and relying on the merge order to hide it
 * is a thinner guarantee than not doing it.
 */
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

/**
 * The caller's style with every entry resolved to its current value, including
 * a Solid accessor or `MotionValue` motion otherwise drives itself.
 *
 * Layout projection needs this rather than `plainStyle`: motion-dom reads
 * `pointerEvents` (and composes a caller-set `transform`) straight off this
 * value on every paint, never off the animated `latestValues`, so a
 * motion-driven entry that `plainStyle` would drop has to resolve here instead.
 */
export function resolveStyle(
  style: MotionStyle | undefined,
): Record<string, unknown> {
  if (!style) return {};

  const resolved: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(style)) {
    resolved[key] = read(entry as MotionSource<string | number>);
  }
  return resolved;
}

export interface BoundStyle {
  values: Map<string, MotionValue>;
  /**
   * Initial values to paint before a bound MotionValue changes.
   *
   * Binding a value does not schedule the initial composite render: motion
   * records it in the shared style state but only repaints when the value
   * next *changes*. Skipping or bypassing `painted` can leave a transform
   * bound at, say, `x: 50` rendering as `transform: none` until something
   * moves.
   */
  painted: Record<string, string | number>;
}

/**
 * Separates the style entries motion owns from the plain CSS the DOM owns.
 *
 * Bindings are read once, not tracked: which keys motion drives describes the
 * element, like `initial` does. Reading this reactively, or changing which
 * keys are driven mid-life, would need unbinding and rebinding the shared
 * transform composite; skipping that can leave stale transform bindings,
 * duplicate subscriptions, or leaks.
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

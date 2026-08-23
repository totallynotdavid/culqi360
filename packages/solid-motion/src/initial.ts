import {
  buildHTMLStyles,
  camelToDash,
  type HTMLRenderState,
  type ResolvedValues,
} from "motion-dom";

import type { TargetAndTransition } from "./types";

/**
 * Turns a target into the inline style an element is born with.
 *
 * Pure: no DOM, no element, no browser globals, so it produces byte-identical
 * output on the server and during the client's first render. That is what keeps
 * hydrated markup from flashing the un-animated state.
 *
 * Transform composition is delegated to motion-dom rather than assembled here.
 * Building the string by hand looks trivial and is not: transforms do not
 * commute, so `{ scale, x }` and `{ x, scale }` must both serialise in
 * motion's canonical order or the element visibly jumps the moment the
 * animation engine takes over and writes the order it prefers.
 */
export function buildInitialStyle(
  target: TargetAndTransition | undefined,
): Record<string, string | number> {
  if (!target) return {};

  const { transition: _transition, transitionEnd, ...values } = target;
  const state: HTMLRenderState = {
    transform: {},
    transformOrigin: {},
    style: {},
    vars: {},
  };

  // `transitionEnd` describes where the element lands, so on the initial pass
  // it is part of the starting picture rather than a follow-up write.
  buildHTMLStyles(state, { ...values, ...transitionEnd } as ResolvedValues);

  // Hyphenated, because this style is handed to a JSX `style` prop rather than
  // written through motion's renderer. Solid sets an object entry with
  // `setProperty`, which takes CSS property names and silently ignores a
  // camelCase one: `pointerEvents` and `transformOrigin` in an `initial` target
  // never reached the markup, while the animation path assigns
  // `element.style[key]` and applied them fine. Measured: the painted element
  // carried `height: auto; overflow: hidden` and no `pointer-events` at all.
  const style: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(state.style)) {
    style[camelToDash(key)] = value as string | number;
  }

  // Custom properties are already spelled the way CSS wants them.
  return { ...style, ...state.vars } as Record<string, string | number>;
}

/**
 * The same values `buildInitialStyle` renders, but raw rather than as CSS: an
 * animation starting from `x` needs the number `20`, not the string `20px`.
 * `transitionEnd` is folded in for the same reason it is there, since on the
 * initial pass there is no transition for it to land after.
 */
export function toInitialValues(
  target: TargetAndTransition | undefined,
): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  if (!target) return values;

  const { transition: _transition, transitionEnd, ...rest } = target;
  for (const [key, value] of Object.entries({ ...rest, ...transitionEnd })) {
    if (typeof value === "string" || typeof value === "number") {
      values[key] = value;
    }
  }
  return values;
}

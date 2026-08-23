import {
  buildHTMLStyles,
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

  return { ...state.style, ...state.vars } as Record<string, string | number>;
}

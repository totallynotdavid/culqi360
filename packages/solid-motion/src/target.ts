import { positionalKeys, type ValueKeyframesDefinition } from "motion-dom";

import type { TargetAndTransition, Transition } from "./types";

/**
 * One state that wants a say in what the element looks like, in Motion's
 * priority order: `animate` at the bottom, `exit` at the top. A layer that is
 * not currently active contributes nothing.
 */
export interface MotionLayer {
  target: TargetAndTransition | undefined;
  active: boolean;
}

export interface TargetEntry {
  /** A single value, or the keyframe list to run through. */
  value: ValueKeyframesDefinition;
  /**
   * The transition of the layer this value came from, so an `exit` carrying its
   * own timing does not get the element's default.
   */
  transition: Transition | undefined;
}

export interface MergedTarget {
  entries: Map<string, TargetEntry>;
  transitionEnd: Record<string, string | number>;
  /**
   * The transition of the highest-priority active layer. Child orchestration is
   * read from here, because `staggerChildren` belongs to whichever variant is
   * currently driving the parent.
   */
  transition: Transition | undefined;
}

/**
 * Collapses the active layers into one target, highest priority winning per key.
 *
 * Motion does this with `AnimationState`: a reverse walk over the priority order
 * carrying `protectedKeys`, `encounteredKeys` and `prevResolvedValues` so that a
 * lower layer never animates a key a higher one already owns. That bookkeeping
 * exists because the merge is incremental and must not restart animations it
 * did not change.
 *
 * Recomputing the whole merge is cheaper to reason about and costs nothing here,
 * because the controller decides what to restart by diffing values rather than
 * by tracking which layer touched what. Which layer owns a key falls out of the
 * iteration order instead of being carried in a side table.
 */
export function mergeLayers(
  layers: readonly MotionLayer[],
  fallbackTransition: Transition | undefined,
): MergedTarget {
  const entries = new Map<string, TargetEntry>();
  const transitionEnd: Record<string, string | number> = {};
  let winning = fallbackTransition;

  for (const layer of layers) {
    if (!layer.active || !layer.target) continue;

    const { transition, transitionEnd: end, ...values } = layer.target;
    const layerTransition = transition ?? fallbackTransition;
    winning = layerTransition;

    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null) continue;
      entries.set(key, {
        value: value as ValueKeyframesDefinition,
        transition: layerTransition,
      });
    }

    if (end) Object.assign(transitionEnd, end);
  }

  return { entries, transitionEnd, transition: winning };
}

/**
 * Motion's reduced-motion contract is not "do not animate". Positional and
 * layout properties jump; opacity, colour and the rest still animate, because
 * those are the ones that carry meaning rather than movement.
 */
export function withoutMovement(target: MergedTarget): MergedTarget {
  const entries = new Map(target.entries);
  for (const [key, entry] of entries) {
    if (!positionalKeys.has(key)) continue;
    entries.set(key, { ...entry, transition: { type: false } as Transition });
  }
  return {
    entries,
    transitionEnd: target.transitionEnd,
    transition: target.transition,
  };
}

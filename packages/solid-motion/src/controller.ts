import { frame, type AnimationPlaybackControlsWithThen } from "motion-dom";

import type { MergedTarget } from "./target";
import type { AnimationDefinition, Transition } from "./types";
import { createValueStore, type ValueStore } from "./values";

/**
 * Everything one animation pass needs, already resolved. The component computes
 * this inside a tracking scope; the controller only ever receives plain values
 * and only ever performs side effects.
 */
export interface MotionPass {
  target: MergedTarget;
  /** The target the element was rendered with, in raw (pre-CSS) units. */
  initialValues: Record<string, string | number>;
  /** Used by values falling back after the layer that owned them went away. */
  fallbackTransition: Transition | undefined;
  /** Handed back to lifecycle callbacks unchanged, for reporting only. */
  definition: AnimationDefinition;
  onAnimationStart?: (definition: AnimationDefinition) => void;
  onAnimationComplete?: (definition: AnimationDefinition) => void;
  onUpdate?: (latest: Record<string, string | number>) => void;
}

export interface MotionController {
  mount(element: HTMLElement | SVGElement): void;
  /**
   * Runs a pass. `onSettled` is called exactly once: with `true` when the pass
   * reached its target, with `false` when a later pass or disposal took over.
   */
  run(pass: MotionPass, onSettled?: (completed: boolean) => void): void;
  dispose(): void;
}

export function createMotionController(): MotionController {
  let store: ValueStore | undefined;
  let queued:
    | { pass: MotionPass; onSettled?: (completed: boolean) => void }
    | undefined;
  let onUpdate: MotionPass["onUpdate"];
  let observing = false;

  /**
   * What the element was last told to become, so a pass only touches values that
   * actually changed. Seeded from the initial target, because that is what the
   * element was rendered carrying.
   */
  let applied = new Map<string, string | number>();

  /**
   * Identifies the pass allowed to settle. A cancelled motion animation's
   * `finished` promise never resolves *and* never rejects, so "this pass lost"
   * has to be an event we raise ourselves. Without it, a caller waiting on an
   * exit animation that got interrupted waits forever.
   */
  let generation = 0;
  let release: ((completed: boolean) => void) | undefined;

  const supersede = () => {
    generation += 1;
    const previous = release;
    release = undefined;
    previous?.(false);
  };

  const complete = (pass: number) => {
    if (pass !== generation) return;
    const settled = release;
    release = undefined;
    settled?.(true);
  };

  const start = (
    pass: MotionPass,
    onSettled?: (completed: boolean) => void,
  ) => {
    supersede();
    release = onSettled;

    const current = generation;
    if (!store) return;

    // Installed once and reading the latest callback, so a component that swaps
    // its `onUpdate` does not resubscribe every value.
    onUpdate = pass.onUpdate;
    if (onUpdate && !observing) {
      observing = true;
      store.observe((latest) => onUpdate?.(latest));
    }

    const work = planWork(pass, applied, store);
    applied = work.applied;

    const { transitionEnd } = pass.target;

    const finish = () => {
      if (current !== generation) return;
      for (const [key, value] of Object.entries(transitionEnd)) {
        store?.set(key, value);
        applied.set(key, value);
      }
      pass.onAnimationComplete?.(pass.definition);
      complete(current);
    };

    if (work.changes.length === 0) {
      finish();
      return;
    }

    pass.onAnimationStart?.(pass.definition);

    // Animations are created on motion's frame, never inline in Solid's flush.
    //
    // `time.now()` memoises per synchronous block and is only cleared on a
    // microtask, so an animation started from the middle of a long synchronous
    // render is handed the clock reading from the top of that block. It is born
    // with a start time in the past and completes on its first tick: a 100ms
    // fade that never fades. Measured at 107ms of drift for a single component
    // render, and a route transition or a long list is worse.
    //
    // Inside `frame.update` the clock is the frame's own, which is the clock the
    // animation's ticks read. It also coalesces every element animating in one
    // Solid flush into a single frame.
    frame.update(() => {
      if (current !== generation || !store) return;

      const animations: AnimationPlaybackControlsWithThen[] = [];
      for (const change of work.changes) {
        const animation = store.animate(
          change.key,
          change.value,
          change.transition,
        );
        if (animation) animations.push(animation);
      }

      // Motion resolves instant targets without creating an animation at all,
      // so an empty list means the pass is already where it was going.
      if (animations.length === 0) {
        finish();
        return;
      }

      // Waiting on every `finished` is only safe because `finish` is generation
      // guarded: a cancelled member never settles, and by then the pass that
      // replaced it has already released this one with `false`.
      Promise.all(animations.map((animation) => animation.finished))
        .then(finish)
        .catch(() => undefined);
    });
  };

  return {
    mount(element) {
      const initialValues = queued?.pass.initialValues ?? {};
      store = createValueStore(element, initialValues);
      applied = new Map(Object.entries(initialValues));

      if (!queued) return;

      const { pass, onSettled } = queued;
      queued = undefined;
      release = undefined;
      start(pass, onSettled);
    },

    run(pass, onSettled) {
      // The ref has not fired yet. Hold the pass instead of dropping it: the
      // element it needs is the one about to be handed to `mount`.
      if (!store) {
        queued?.onSettled?.(false);
        queued = { pass, onSettled };
        return;
      }
      start(pass, onSettled);
    },

    dispose() {
      supersede();
      queued?.onSettled?.(false);
      queued = undefined;
      store?.dispose();
      store = undefined;
    },
  };
}

interface ValueChange {
  key: string;
  value: string | number;
  transition: Transition | undefined;
}

/**
 * Which values this pass actually has to move, and what the element becomes as a
 * result.
 *
 * Diffing per value rather than per target is what stops an unrelated prop
 * update from restarting animations: re-running a pass whose `opacity` did not
 * change must not stop `opacity` and restart it from wherever it currently sits.
 *
 * A key that disappeared from the target goes back to the value the element was
 * bound at. Motion calls these removed keys, and handling them is what makes a
 * gesture state releasable: when `whileHover` stops contributing `scale`,
 * `scale` has to return somewhere rather than staying where the gesture left it.
 */
function planWork(
  pass: MotionPass,
  applied: Map<string, string | number>,
  store: ValueStore,
): { changes: ValueChange[]; applied: Map<string, string | number> } {
  const changes: ValueChange[] = [];
  const next = new Map<string, string | number>();

  for (const [key, entry] of pass.target.entries) {
    next.set(key, entry.value);
    if (Object.is(applied.get(key), entry.value)) continue;
    changes.push({ key, value: entry.value, transition: entry.transition });
  }

  for (const key of applied.keys()) {
    if (next.has(key)) continue;

    const base = store.baseValue(key) ?? pass.initialValues[key];
    if (base === undefined) continue;

    next.set(key, base);
    if (Object.is(applied.get(key), base)) continue;
    changes.push({ key, value: base, transition: pass.fallbackTransition });
  }

  return { changes, applied: next };
}

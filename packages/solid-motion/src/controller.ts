import { frame, type AnimationPlaybackControlsWithThen } from "motion-dom";

import type {
  AnimationDefinition,
  TargetAndTransition,
  Transition,
} from "./types";
import { createValueStore, type ValueStore } from "./values";

/**
 * Everything one animation pass needs, already resolved. The component computes
 * this inside a tracking scope; the controller only ever receives plain values
 * and only ever performs side effects.
 */
export interface MotionPass {
  target: TargetAndTransition | undefined;
  /** The target the element was rendered with, in raw (pre-CSS) units. */
  initialValues: Record<string, string | number>;
  transition: Transition | undefined;
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

    // The listener is installed once and reads the latest callback, so a
    // component that swaps its `onUpdate` does not resubscribe every value.
    onUpdate = pass.onUpdate;
    if (onUpdate && !observing) {
      observing = true;
      store.observe((latest) => onUpdate?.(latest));
    }

    const {
      transition: _transition,
      transitionEnd,
      ...rest
    } = pass.target ?? {};
    const values = rest as Record<string, string | number>;
    const keys = Object.keys(values);

    if (keys.length === 0) {
      complete(current);
      return;
    }

    pass.onAnimationStart?.(pass.definition);

    const finish = () => {
      if (current !== generation) return;
      if (transitionEnd) {
        for (const [key, value] of Object.entries(transitionEnd)) {
          store?.set(key, value as string | number);
        }
      }
      pass.onAnimationComplete?.(pass.definition);
      complete(current);
    };

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
      for (const key of keys) {
        const animation = store.animate(key, values[key], pass.transition);
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
      store = createValueStore(element, queued?.pass.initialValues ?? {});
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

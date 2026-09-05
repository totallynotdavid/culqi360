import {
  frame,
  type AnimationPlaybackControlsWithThen,
  type MotionValue,
  type ValueKeyframesDefinition,
} from "motion-dom";

import type { LayoutOptions } from "./projection";
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
  /** Used by values falling back after the layer that owned them went away. */
  fallbackTransition: Transition | undefined;
  /** Stagger offset contributed by a variant-controlling ancestor. */
  delay: number;
  /** Jump to every target instead of animating there. */
  skipAnimations: boolean;
  /** Suppresses layout movement for reduced motion and skipped animations. */
  instantLayout: boolean;
  /** Defers the pass until its turn for `when` orchestration. */
  sequence?: (begin: VoidFunction) => void;
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

export function createMotionController(
  /** Initial raw values, captured before the element's ref runs. */
  initialValues: Record<string, string | number>,
  /** Values from `style` that the caller owns; bound, never created here. */
  bound: ReadonlyMap<string, MotionValue>,
  /** Present when the element asked for `layout` or `layoutId`. */
  layout?: LayoutOptions,
): MotionController {
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
  let applied = new Map<string, ValueKeyframesDefinition>(
    Object.entries(initialValues),
  );

  /** Identifies the pass allowed to settle. Cancelled animations may not settle. */
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

    const generationAtStart = generation;
    if (!store) return;

    // Layout timing follows the winning pass. The target's transition is the one
    // the active layer brought, so a `transition.layout` written into a variant
    // or an inline target reaches the projection engine.
    store.setLayoutTiming({
      transition: pass.target.transition,
      instant: pass.instantLayout,
    });

    // Keep one subscription while allowing the callback to change.
    onUpdate = pass.onUpdate;
    if (onUpdate && !observing) {
      observing = true;
      store.observe((latest) => onUpdate?.(latest));
    }

    if (!pass.sequence) {
      begin(pass, generationAtStart);
      return;
    }
    pass.sequence(() => begin(pass, generationAtStart));
  };

  /** Starts the pass after any sequencing delay. */
  const begin = (pass: MotionPass, generationAtStart: number) => {
    if (generationAtStart !== generation || !store) return;

    const work = planWork(pass, applied, store, initialValues);
    applied = work.applied;

    const { transitionEnd } = pass.target;

    const finish = () => {
      if (generationAtStart !== generation) return;
      for (const [key, value] of Object.entries(transitionEnd)) {
        store?.set(key, value);
        applied.set(key, value);
      }
      pass.onAnimationComplete?.(pass.definition);
      complete(generationAtStart);
    };

    if (work.changes.length === 0) {
      finish();
      return;
    }

    pass.onAnimationStart?.(pass.definition);

    // Animations are created on motion's frame, never inline in Solid's flush.
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
      if (generationAtStart !== generation || !store) return;

      const animations: AnimationPlaybackControlsWithThen[] = [];
      for (const change of work.changes) {
        const animation = store.animate(
          change.key,
          change.value,
          passTransition(change.transition, pass),
        );
        if (animation) animations.push(animation);
      }

      // Instant targets do not create animations.
      if (animations.length === 0) {
        finish();
        return;
      }

      // Cancelled animations may never settle, so `finish` must remain generation
      // guarded even after all current animations complete.
      Promise.all(animations.map((animation) => animation.finished))
        .then(finish)
        .catch(() => undefined);
    });
  };

  return {
    mount(element) {
      store = createValueStore(element, initialValues, bound, layout);
      if (!queued) return;

      const { pass, onSettled } = queued;
      queued = undefined;
      release = undefined;
      start(pass, onSettled);
    },

    run(pass, onSettled) {
      // The ref has not fired yet. Hold the pass until `mount` provides the store.
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

/** Adds pass-wide delay and animation settings to a value transition. */
function passTransition(
  transition: Transition | undefined,
  pass: MotionPass,
): Transition | undefined {
  if (!pass.delay && !pass.skipAnimations) return transition;

  const own = (transition as { delay?: number } | undefined)?.delay ?? 0;
  return {
    ...transition,
    ...(pass.delay ? { delay: own + pass.delay } : undefined),
    ...(pass.skipAnimations ? { skipAnimations: true } : undefined),
  } as Transition;
}

interface ValueChange {
  key: string;
  value: ValueKeyframesDefinition;
  transition: Transition | undefined;
}

/** Plans changed values and restores keys removed from the target. */
function planWork(
  pass: MotionPass,
  applied: Map<string, ValueKeyframesDefinition>,
  store: ValueStore,
  initialValues: Record<string, string | number>,
): { changes: ValueChange[]; applied: Map<string, ValueKeyframesDefinition> } {
  const changes: ValueChange[] = [];
  const next = new Map<string, ValueKeyframesDefinition>();

  for (const [key, entry] of pass.target.entries) {
    next.set(key, entry.value);
    if (isSameTarget(applied.get(key), entry.value)) continue;
    changes.push({ key, value: entry.value, transition: entry.transition });
  }

  for (const key of applied.keys()) {
    if (next.has(key)) continue;

    const base = store.baseValue(key) ?? initialValues[key];
    if (base === undefined) continue;

    next.set(key, base);
    if (isSameTarget(applied.get(key), base)) continue;
    changes.push({ key, value: base, transition: pass.fallbackTransition });
  }

  return { changes, applied: next };
}

/** Compares keyframe arrays by contents so fresh equivalent arrays do not restart. */
function isSameTarget(
  current: ValueKeyframesDefinition | undefined,
  next: ValueKeyframesDefinition,
): boolean {
  if (Object.is(current, next)) return true;
  if (!Array.isArray(current) || !Array.isArray(next)) return false;

  return (
    current.length === next.length &&
    current.every((value, index) => Object.is(value, next[index]))
  );
}

import {
  frame,
  type MotionValue,
  type ValueKeyframesDefinition,
} from "motion-dom";

import type { MergedTarget } from "./target";
import type { AnimationDefinition, Transition } from "./types";
import {
  claim,
  releaseValueStore,
  sharedValueStore,
  type ValueStore,
} from "./values";

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
  /**
   * Jump to every target instead of animating there.
   *
   * Carried on the pass rather than folded into a transition upstream. It has
   * to reach the transition of every value this pass touches, and a target that
   * brings its own transition replaces the element's, so anything merged into
   * the element-level one is dropped exactly when a variant or an inline
   * `exit={{ ..., transition }}` is in play.
   */
  skipAnimations: boolean;
  /**
   * Holds the pass back until its turn, for `when` orchestration. It is handed
   * the function that starts the pass and calls it whenever it likes, or never.
   *
   * Safe because it sits *inside* `run`: the pass is already the current one by
   * the time it waits, so it supersedes whatever came before, owns the presence
   * hold, and is itself released the moment a later pass arrives. A pass that
   * loses while waiting simply never starts, since starting is generation
   * guarded like everything else here.
   */
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
  /**
   * The target the element was rendered with, in raw (pre-CSS) units. Passed at
   * construction rather than on a pass: it describes the element, not the
   * animation, and the ref fires before the first pass is ever queued. Reaching
   * it through the first pass meant the value store was built with nothing and
   * fell back to reading the DOM, which round-trips a transform through the
   * computed matrix and cannot tell `rotate: 450` from `rotate: 90`.
   */
  initialValues: Record<string, string | number>,
  /** Values from `style` that the caller owns; bound, never created here. */
  bound: ReadonlyMap<string, MotionValue>,
): MotionController {
  let store: ValueStore | undefined;
  let mountedElement: HTMLElement | SVGElement | undefined;
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

    if (!pass.sequence) {
      begin(pass, current);
      return;
    }
    pass.sequence(() => begin(pass, current));
  };

  /**
   * The pass proper, once it is allowed to run. Everything before this point is
   * bookkeeping that a waiting pass must have done already; everything from here
   * changes what the element is, which a pass that lost must not.
   */
  const begin = (pass: MotionPass, current: number) => {
    if (current !== generation || !store || !mountedElement) return;
    const element = mountedElement;

    const work = planWork(pass, applied, store, initialValues);
    applied = work.applied;

    const { transitionEnd } = pass.target;

    // Idempotent because a pass can reach completion two ways once it has
    // started animating: every animation it owns finishing naturally, or
    // `claim()` reporting that one of them got reclaimed first (see below).
    // Either can fire after the other has already run this pass to
    // completion, and only the first one must count.
    let done = false;
    const finish = () => {
      if (current !== generation || done) return;
      done = true;
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

    // How many keys this pass is still waiting on, mirroring
    // `create-animate.ts`'s `runTarget`: a key only counts once it actually
    // starts animating, and only ever counts down once, whichever happens
    // first between its own `finished` resolving naturally and a later call
    // claiming it away. Waiting for this to reach zero, rather than firing
    // `finish` off any single key, is what keeps one property being
    // reclaimed from resolving the whole pass while its other properties are
    // still animating.
    let pending = 0;

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

      for (const change of work.changes) {
        const animation = store.animate(
          change.key,
          change.value,
          passTransition(change.transition, pass),
        );

        if (!animation) {
          // `store.animate()` still stole this pair via `value.start()` even
          // though motion resolved it instantly with nothing to hand back.
          // Claiming it anyway notifies whoever held it before; this pass
          // has nothing left to wait on for this key.
          claim(element, change.key, () => undefined);
          continue;
        }

        pending += 1;

        let keyDone = false;
        const finishKey = () => {
          if (keyDone) return;
          keyDone = true;
          pending -= 1;
          if (pending > 0) return;
          finish();
        };

        // An imperative `animate()` call on this same element/property steals
        // the `MotionValue` this pass just started animating (motion-dom's own
        // `MotionValue.start` stops whatever animation was already running on
        // it) without ever settling that animation's own `finished`. Claiming
        // it lets whichever call takes it next report that back, so this key
        // counts as done the same way its own `finished` resolving naturally
        // would have.
        animation.finished.catch(() => undefined).finally(finishKey);
        claim(element, change.key, finishKey);
      }

      // Motion resolves instant targets without creating an animation at all,
      // so nothing pending means every key this pass touched already reached
      // its target.
      if (pending === 0) {
        finish();
        return;
      }
    });
  };

  return {
    mount(element) {
      mountedElement = element;
      store = sharedValueStore(element, initialValues, bound);
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
      if (store && mountedElement) releaseValueStore(mountedElement, store);
      store = undefined;
    },
  };
}

/**
 * The transition one value actually runs with: whatever the winning layer asked
 * for, plus the two things the pass decides for every value alike.
 *
 * A stagger offset adds to the delay the transition already asked for rather
 * than replacing it, so a variant can stagger its children and still hold each
 * of them back by its own delay.
 */
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

/**
 * A keyframe array is compared by contents, never by identity.
 *
 * `animate={{ opacity: [0, 1], x: position() }}` rebuilds the whole object every
 * time `position()` changes, so an equal-but-fresh array arrives on each pass.
 * Comparing those by identity restarts the opacity sequence from its first
 * keyframe on every unrelated change, which is the exact defect per-value
 * diffing exists to prevent. One shallow pass, only ever over a keyframe list.
 */
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

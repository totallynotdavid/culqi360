import {
  frame,
  GroupAnimationWithThen,
  positionalKeys,
  resolveElements,
  type AnimationPlaybackControlsWithThen,
  type ElementOrSelector,
  type TimelineWithFallback,
  type ValueKeyframesDefinition,
} from "motion-dom";
import { createSignal, onCleanup } from "solid-js";

import { useMotionConfig } from "./config";
import { useReducedMotion } from "./reduced-motion";
import type {
  MotionConfigState,
  TargetAndTransition,
  Transition,
} from "./types";
import { claim, sharedValueStore, type ValueStore } from "./values";

/** A Solid ref whose current element is also the root for selector targets. */
export type AnimateScope<T extends Element = HTMLElement> = ((
  element: T,
) => void) & {
  readonly current: T | undefined;
};

export type AnimateTarget = ElementOrSelector;

export type AnimateSegment = readonly [
  target: AnimateTarget,
  definition: TargetAndTransition,
];

/**
 * Segments run in order, with each one waiting for the previous one to finish.
 */
export type AnimateSequence = readonly AnimateSegment[];

export interface AnimateFunction {
  (
    target: AnimateTarget,
    definition: TargetAndTransition,
  ): AnimationPlaybackControlsWithThen;
  (sequence: AnimateSequence): AnimationPlaybackControlsWithThen;
}

/**
 * The store for an element `animate()` targets. Shared with any
 * `createMotion` binding on the same node through `sharedValueStore`, rather
 * than built fresh here, so a value one side is driving keeps receiving the
 * other's updates instead of losing its DOM binding to a second, independent
 * `MotionValue` for the same key.
 */
function storeFor(element: Element): ValueStore {
  return sharedValueStore(element as HTMLElement | SVGElement, {}, new Map());
}

/**
 * Element lists are arrays too, so a non-empty sequence is identified by
 * nested tuples. An empty array is ambiguous by shape alone (it fits both
 * overloads), so it is resolved by arity instead, the same way the two
 * `AnimateFunction` overloads are: a sequence call never passes `definition`.
 */
function isSequence(
  targetOrSequence: AnimateTarget | AnimateSequence,
  definition: TargetAndTransition | undefined,
): targetOrSequence is AnimateSequence {
  if (!Array.isArray(targetOrSequence)) return false;
  if (targetOrSequence.length === 0) return definition === undefined;
  return targetOrSequence.some((entry) => Array.isArray(entry));
}

/**
 * Reduced motion disables positional animation, while `skipAnimations` tells
 * motion-dom to apply the target immediately. Both, and the fallback
 * transition, are read from `config` here rather than passed down as
 * precomputed values: a segment that starts after a live config change (a
 * sequence's later segments, chiefly) has to see that change, not whatever
 * was current when `animate()` was first called.
 */
function resolveTransition(
  key: string,
  transition: Transition | undefined,
  config: MotionConfigState,
  prefersReducedMotion: () => boolean,
): Transition | undefined {
  const reducedMotion =
    config.reducedMotion === "always" ||
    (config.reducedMotion === "user" && prefersReducedMotion());
  const own = transition ?? config.transition;

  if (reducedMotion && positionalKeys.has(key)) {
    return { type: false } as Transition;
  }
  if (!config.skipAnimations) return own;
  return { ...own, skipAnimations: true } as Transition;
}

/**
 * Proxy controls to the current animation. It is created on the update frame,
 * and sequences replace it as each segment finishes.
 *
 * A caller can reach for these controls in the same tick as `animate()`,
 * before that frame has run and `getActive()` has anything to return.
 * `pause`, `complete`, `time`, `speed` and `attachTimeline` queue themselves
 * in that case instead of silently doing nothing, and `applyPending` (the
 * second return value) replays the queue in order once the real animation
 * exists. `play`, `stop` and `cancel` need no queue: playing is already the
 * state a fresh animation starts in, and `stop` settles `finished` itself
 * without waiting on `getActive()` at all.
 */
function delegatedControls(
  finished: Promise<void>,
  getActive: () => AnimationPlaybackControlsWithThen | undefined,
  stop: VoidFunction,
): [controls: AnimationPlaybackControlsWithThen, applyPending: VoidFunction] {
  let pending: Array<(active: AnimationPlaybackControlsWithThen) => void> = [];

  const runOrQueue = (
    op: (active: AnimationPlaybackControlsWithThen) => void,
  ): void => {
    const active = getActive();
    if (active) {
      op(active);
      return;
    }
    pending.push(op);
  };

  const applyPending = (): void => {
    const active = getActive();
    if (!active || pending.length === 0) return;
    const queued = pending;
    pending = [];
    for (const op of queued) op(active);
  };

  const controls: AnimationPlaybackControlsWithThen = {
    get time() {
      return getActive()?.time ?? 0;
    },
    set time(value: number) {
      runOrQueue((active) => {
        active.time = value;
      });
    },
    get speed() {
      return getActive()?.speed ?? 1;
    },
    set speed(value: number) {
      runOrQueue((active) => {
        active.speed = value;
      });
    },
    get startTime() {
      return getActive()?.startTime ?? null;
    },
    get state() {
      return getActive()?.state ?? "idle";
    },
    get duration() {
      return getActive()?.duration ?? 0;
    },
    get iterationDuration() {
      return getActive()?.iterationDuration ?? 0;
    },
    finished,
    stop,
    play() {
      getActive()?.play();
    },
    pause() {
      runOrQueue((active) => active.pause());
    },
    complete() {
      runOrQueue((active) => active.complete());
    },
    cancel() {
      stop();
      getActive()?.cancel();
    },
    attachTimeline: (timeline: TimelineWithFallback) => {
      const active = getActive();
      if (active) return active.attachTimeline(timeline);

      let cancelled = false;
      let detach: VoidFunction | undefined;
      pending.push((realized) => {
        if (cancelled) return;
        detach = realized.attachTimeline(timeline);
      });
      return () => {
        cancelled = true;
        detach?.();
      };
    },
    then: (onResolve, onReject) => finished.then(onResolve, onReject),
  };

  return [controls, applyPending];
}

/**
 * `current` is the scope element the ref supplies once it mounts. Before
 * that there is no root to search a selector target from, and `resolveElements`
 * asked for one without a scope falls back to `document.querySelectorAll`,
 * which both escapes the intended scope to the whole page and throws where
 * `document` doesn't exist at all (SSR). So a selector target simply resolves
 * to no elements until the scope has a root to search from; every other
 * target shape names its own elements directly and needs no root regardless.
 */
function resolveScopedElements(
  target: AnimateTarget,
  current: Element | undefined,
): Element[] {
  if (current) return resolveElements(target, { current, animations: [] });
  if (typeof target === "string") return [];
  return resolveElements(target);
}

/**
 * Resolve targets now so selector scope is stable. Defer animation creation to
 * motion-dom's frame update so it receives the current frame time.
 */
function runTarget(
  target: AnimateTarget,
  definition: TargetAndTransition,
  current: Element | undefined,
  config: MotionConfigState,
  prefersReducedMotion: () => boolean,
): AnimationPlaybackControlsWithThen {
  const elements = resolveScopedElements(target, current);
  const { transition, transitionEnd, ...values } = definition;

  const applyTransitionEnd = (): void => {
    if (!transitionEnd) return;
    for (const element of elements) {
      const store = storeFor(element);
      for (const [key, value] of Object.entries(transitionEnd)) {
        store.set(key, value);
      }
    }
  };

  let active: GroupAnimationWithThen | undefined;
  let settle: VoidFunction | undefined;
  let applyPending: VoidFunction = () => undefined;

  // How many (element, key) pairs this call is still waiting on. A pair only
  // counts once it actually starts animating (a key motion resolves
  // instantly never joins `animations`, so it plays no part here), and only
  // ever counts down once: whichever happens first between the animation's
  // own `finished` resolving naturally and a later call claiming that same
  // pair away marks it done, and the other is then a no-op. Waiting for this
  // to reach zero, rather than tying completion to any single pair, is what
  // keeps one property being reclaimed from resolving the whole call while
  // its other properties are still animating under `active`.
  let pending = 0;

  const finished = new Promise<void>((resolve) => {
    settle = resolve;

    frame.update(() => {
      if (!settle) return;

      const animations: AnimationPlaybackControlsWithThen[] = [];
      for (const element of elements) {
        const store = storeFor(element);
        for (const [key, value] of Object.entries(values)) {
          if (value === undefined || value === null) continue;

          const animation = store.animate(
            key,
            value as ValueKeyframesDefinition,
            resolveTransition(key, transition, config, prefersReducedMotion),
          );

          if (!animation) {
            // `store.animate()` still called `value.start()` on this pair,
            // which steals it from whoever was driving it before even though
            // motion resolved the target instantly and returned nothing to
            // wait on. Claiming it anyway is what lets that notification
            // reach them; this call itself has nothing left to wait on here,
            // since the jump already happened synchronously above.
            claim(element, key, () => undefined);
            continue;
          }

          animations.push(animation);
          pending += 1;

          let keyDone = false;
          const finishKey = () => {
            if (keyDone) return;
            keyDone = true;
            pending -= 1;
            if (pending > 0 || !settle) return;
            applyTransitionEnd();
            settle();
          };

          // A later `animate()` call for this same element/property steals
          // the `MotionValue` this one just started animating (motion-dom's
          // own `MotionValue.start` stops whatever animation was already
          // running on it) without ever settling that animation's own
          // `finished`. Registering the claim here lets the newer call mark
          // this pair done the moment that happens, the same way its own
          // `finished` resolving naturally would have.
          animation.finished.catch(() => undefined).finally(finishKey);
          claim(element, key, finishKey);
        }
      }

      // Motion resolves an instant target (an empty selector, a definition
      // with nothing animatable, or a skipped transition) without creating an
      // animation at all, but it still applies the final value on a
      // `frame.update` it schedules from right here, one frame out. Settling
      // on this same frame would let `transitionEnd` land before that write,
      // only for it to be overwritten the moment motion's own deferred update
      // runs. Queuing this settlement the same way, from inside the same
      // callback, puts it after motion's write in that next frame's queue.
      if (animations.length === 0) {
        frame.update(() => {
          if (!settle) return;
          applyTransitionEnd();
          settle();
        });
        return;
      }

      active = new GroupAnimationWithThen(animations);
      // A `.pause()`, `.complete()`, `.time`/`.speed` write, or
      // `.attachTimeline()` made before this point queued itself on the
      // controls below instead of finding nothing to act on; replay it now
      // that there is something to act on.
      applyPending();
    });
  });

  const stop = () => {
    if (!settle) return;
    const resolve = settle;
    settle = undefined;
    active?.stop();
    // motion-dom's `stop()` tears down the driver without settling
    // `finished` (verified against motion-dom 13.1.1), so a stopped run has
    // to settle its own promise rather than wait on one that never will.
    resolve();
  };

  const [controls, flush] = delegatedControls(finished, () => active, stop);
  applyPending = flush;
  return controls;
}

function runSequence(
  sequence: AnimateSequence,
  current: Element | undefined,
  config: MotionConfigState,
  prefersReducedMotion: () => boolean,
): AnimationPlaybackControlsWithThen {
  let active: AnimationPlaybackControlsWithThen | undefined;
  let stopped = false;

  const finished = (async () => {
    for (const [target, definition] of sequence) {
      if (stopped) return;
      active = runTarget(
        target,
        definition,
        current,
        config,
        prefersReducedMotion,
      );
      // Segments run in order by contract (see `AnimateSequence`): each one
      // has to settle before the next starts, so this cannot become a
      // `Promise.all()` without collapsing the sequence into one that runs
      // every segment at once.
      // eslint-disable-next-line no-await-in-loop
      await active.finished.catch(() => undefined);
    }
  })();

  const [controls] = delegatedControls(
    finished,
    () => active,
    () => {
      stopped = true;
      active?.stop();
    },
  );
  return controls;
}

/** Create a Solid ref and an imperative animation function for its scope. */
export function createAnimate<T extends Element = HTMLElement>(): [
  scope: AnimateScope<T>,
  animate: AnimateFunction,
] {
  const [element, setElement] = createSignal<T>();

  // Solid refs are callbacks, so add `current` to the callable ref shape.
  const scope = ((node: T) =>
    setElement(() => node)) as unknown as AnimateScope<T>;
  Object.defineProperty(scope, "current", { get: () => element() });

  const prefersReducedMotion = useReducedMotion();
  const config = useMotionConfig();

  const running: AnimationPlaybackControlsWithThen[] = [];
  const track = (animation: AnimationPlaybackControlsWithThen) => {
    running.push(animation);
    animation.finished
      .catch(() => undefined)
      .finally(() => {
        const index = running.indexOf(animation);
        if (index !== -1) running.splice(index, 1);
      });
  };

  // Stop animations when the scope unmounts so detached elements stop receiving
  // frames.
  onCleanup(() => {
    for (const animation of running) animation.stop();
    running.length = 0;
  });

  const animate = ((
    targetOrSequence: AnimateTarget | AnimateSequence,
    definition?: TargetAndTransition,
  ): AnimationPlaybackControlsWithThen => {
    const current = element();

    // `config` and `prefersReducedMotion` are handed down as-is rather than
    // resolved to booleans here: a sequence's later segments start well
    // after this call returns, and need whatever `MotionConfig` says at that
    // later point, not a snapshot from before the sequence even began.
    const result = isSequence(targetOrSequence, definition)
      ? runSequence(targetOrSequence, current, config, prefersReducedMotion)
      : runTarget(
          targetOrSequence,
          definition!,
          current,
          config,
          prefersReducedMotion,
        );

    track(result);
    return result;
  }) as AnimateFunction;

  return [scope, animate];
}

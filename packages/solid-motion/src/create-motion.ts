import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";

import { useMotionConfig } from "./config";
import { createMotionController, type MotionPass } from "./controller";
import { gestureNames, watchGestures } from "./gestures";
import { buildInitialStyle, toInitialValues } from "./initial";
import { usePresence } from "./presence";
import { useReducedMotion } from "./reduced-motion";
import { resolveDefinition, resolveInitialDefinition } from "./resolve";
import { mergeLayers, withoutMovement } from "./target";
import type { MotionOptions, Transition } from "./types";
import {
  createVariantScope,
  useVariants,
  type VariantLayer,
  type VariantScope,
} from "./variants";

/**
 * What `createMotion` hands back: an inline style to render the element with and
 * a ref to attach to it. Everything after the first paint is written straight to
 * the node by motion-dom, so neither of these is a reactive value the consumer
 * has to keep re-reading.
 */
export interface MotionHandle {
  /**
   * The style the element must be born carrying, on the server and in the
   * client's first render alike. Merge it over any style of your own; the
   * motion target has to win, or the first frame paints the wrong picture.
   */
  style: Record<string, string | number>;
  ref: (element: HTMLElement | SVGElement) => void;
  /**
   * The variant scope this element offers its descendants, or `null` when it
   * names no variant labels.
   *
   * Returned rather than provided, because Solid has no imperative context
   * setter: a value reaches descendants only by rendering them inside the
   * provider component. A ref runs after its own subtree already exists, so a
   * primitive cannot do it. Leaf animations, which is nearly all of them, never
   * need this; `<motion.div>` provides it for the parents that do.
   */
  scope: VariantScope | null;
}

/**
 * Animation for an element you render yourself.
 *
 * This is the whole engine. `<motion.div>` is this function plus a `Dynamic`
 * and a prop spread, and the spread is what it costs: every attribute goes
 * through runtime diffing instead of the static setters Solid's compiler would
 * otherwise emit. Calling the primitive directly keeps `class`, `onClick` and
 * the rest compiled, which is what makes it worth having under a long list.
 *
 * Options arrive as a thunk so they stay reactive. A fresh object on every read
 * is fine and costs nothing: values are diffed one at a time, so an unchanged
 * `opacity` in a rebuilt target is not an animation to restart.
 */
export function createMotion<TCustom = unknown>(
  options: () => MotionOptions<TCustom>,
): MotionHandle {
  const prefersReducedMotion = useReducedMotion();
  const config = useMotionConfig();
  const presence = usePresence();

  // The gestures need the node inside a tracking scope, so it lives in a signal
  // rather than a plain `let` the effects could never observe.
  const [element, setElement] = createSignal<HTMLElement | SVGElement>();
  const gestures = watchGestures(options, element);

  const inherited = useVariants();
  // Only this element's own `custom` is typed. An ancestor's variant scope or a
  // presence boundary knows nothing about this element's variant map, so what
  // they carry is `unknown` and this is where it gets read as the local type.
  const custom = (): TCustom | undefined =>
    (options().custom ?? inherited?.custom() ?? presence?.custom()) as
      | TCustom
      | undefined;

  // A layer falls back to the ancestor's label only when this element says
  // nothing about it, matching Motion. An inline target is never inherited: it
  // means nothing to a child resolving against a different variants map.
  const definitionFor = (layer: VariantLayer) => {
    const own = options()[layer];
    return own !== undefined ? own : inherited?.label(layer);
  };

  const resolveLayer = (layer: VariantLayer) =>
    resolveDefinition(definitionFor(layer), options().variants, custom());

  // The initial target is resolved exactly once. It describes the element the
  // browser is handed, so re-resolving it later would describe a paint that
  // already happened. A boundary-level `initial={false}` wins over the element's
  // own option: it means "this subtree was already on screen".
  const initialTarget = untrack(() =>
    resolveInitialDefinition({
      initial: presence?.initial() === false ? false : definitionFor("initial"),
      animate: definitionFor("animate"),
      variants: options().variants,
      custom: custom(),
    }),
  );

  const controller = createMotionController(toInitialValues(initialTarget));
  onCleanup(controller.dispose);

  const fallbackTransition = createMemo(() =>
    withConfig(
      options().transition ?? config.transition,
      config.skipAnimations ?? false,
    ),
  );

  // `exit` sits on top of `animate` rather than replacing it, so a key `animate`
  // owns and `exit` says nothing about keeps its animated value instead of
  // falling back on the way out.
  const merged = createMemo(() =>
    mergeLayers(
      [
        { target: resolveLayer("animate"), active: true },
        ...gestureNames.map((name) => ({
          target: resolveLayer(name),
          active: gestures[name](),
        })),
        {
          target: resolveLayer("exit"),
          active: presence ? !presence.isPresent() : false,
        },
      ],
      fallbackTransition(),
    ),
  );

  createEffect(
    () => (inherited ? element() : undefined),
    (node) => (node ? inherited?.register(node) : undefined),
  );

  createEffect(
    () => {
      const present = presence ? presence.isPresent() : true;
      const reducedMotion =
        config.reducedMotion === "always" ||
        (config.reducedMotion === "user" && prefersReducedMotion());

      const target = merged();
      const node = element();
      const current = options();

      return {
        present,
        definition: present ? definitionFor("animate") : definitionFor("exit"),
        target: reducedMotion ? withoutMovement(target) : target,
        fallbackTransition: fallbackTransition(),
        // Read here so the delay tracks the ancestor's orchestration, and so a
        // sibling entering or leaving restaggers the row.
        delay: node && inherited ? inherited.delayFor(node) : 0,
        onAnimationStart: current.onAnimationStart,
        onAnimationComplete: current.onAnimationComplete,
        onUpdate: current.onUpdate,
      };
    },
    (next) => {
      const pass: MotionPass = {
        target: next.target,
        delay: next.delay,
        fallbackTransition: next.fallbackTransition,
        definition: next.definition,
        onAnimationStart: next.onAnimationStart,
        onAnimationComplete: next.onAnimationComplete,
        onUpdate: next.onUpdate,
      };

      if (next.present) {
        // Superseding an exit pass releases the hold that pass was carrying, so
        // returning to the screen needs no bookkeeping of its own.
        controller.run(pass);
        return;
      }

      // Each pass owns exactly one hold and releases exactly that one. A shared
      // variable cannot do this: `run` synchronously settles the pass it
      // replaces, so a callback reading the current hold would release the one
      // just taken and drop the boundary's count to zero mid-exit.
      //
      // Taking the hold before `run` is what keeps the count from touching zero
      // between two passes of the same exit.
      const release = presence?.hold();
      controller.run(pass, () => release?.());
    },
  );

  return {
    style: buildInitialStyle(initialTarget),
    ref: (node) => {
      controller.mount(node);
      setElement(node);
    },
    scope: createVariantScope(options, custom, () => merged().transition),
  };
}

function withConfig(
  transition: Transition | undefined,
  skipAnimations: boolean,
): Transition | undefined {
  if (!skipAnimations) return transition;
  return { ...transition, skipAnimations } as Transition;
}

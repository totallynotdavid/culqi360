import {
  createEffect,
  createMemo,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
  untrack,
} from "solid-js";

import { useMotionConfig } from "./config";
import { createMotionController, type MotionPass } from "./controller";
import { gestureNames, watchGestures } from "./gestures";
import { buildInitialRender, toInitialValues } from "./initial";
import { noteStyleChange } from "./layout-updates";
import { readStyleValues, resolveStyle } from "./motion-values";
import { usePresence } from "./presence";
import type { LayoutOptions } from "./projection";
import { useReducedMotion } from "./reduced-motion";
import { resolveDefinition, resolveInitialDefinition } from "./resolve";
import { mergeLayers, withoutMovement } from "./target";
import type { MotionOptions, TargetAndTransition } from "./types";
import {
  createVariantScope,
  sequencePass,
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
  /**
   * The attributes it must be born carrying, for the same reason. Always empty
   * unless the element is an SVG child, where geometry like `x1` and `r` is an
   * attribute and setting it as style does nothing at all.
   */
  attrs: Record<string, string | number>;
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
  /**
   * The tag being rendered, when the caller knows it. It only decides whether
   * the initial target is painted as style or as attributes; everything after
   * the first frame reads the element itself.
   */
  tag?: string,
): MotionHandle {
  const prefersReducedMotion = useReducedMotion();
  const config = useMotionConfig();
  const presence = usePresence();

  // Captured before `ref` fires: a ref callback runs outside any reactive
  // owner, so `onCleanup` called from inside it is silently never scheduled.
  // Registering a child's cleanup needs this owner handed back in explicitly.
  const owner = getOwner();

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
  // already happened. A boundary-level `initial={false}` wins over the
  // element's own option: it means "this subtree was already on screen".
  const initialTarget = untrack(() =>
    resolveInitialDefinition({
      initial: presence?.initial() === false ? false : definitionFor("initial"),
      animate: definitionFor("animate"),
      variants: options().variants,
      custom: custom(),
    }),
  );

  // Read once, like the initial target: which keys motion drives describes the
  // element, and only their values are expected to change afterwards.
  const bound = untrack(() => readStyleValues(options().style));

  // `layout`/`layoutId` describe the node, so capture them with the initial
  // target; `style` stays a live read, since projection calls it on every
  // paint rather than once at mount.
  const layout = untrack((): LayoutOptions | undefined => {
    const current = options();
    if (!current.layout && current.layoutId === undefined) return undefined;
    return {
      layout: current.layout,
      layoutId: current.layoutId,
      style: () => resolveStyle(options().style),
    };
  });

  // The caller's own plain CSS lands on the element through Solid's native
  // reactivity (`motion.tsx`'s merged `style`), not through this package's own
  // paint loop, so `claimInlineStyle` (values.ts) cannot tell it apart from
  // paint and would otherwise read it as one. Solid already tracks it
  // precisely; feed changes into the same touched/commit path a document
  // mutation would take. Deferred because mounting already schedules its own
  // commit when one is needed.
  createEffect(
    () => {
      // `resolveStyle`, not `plainStyle`: it calls every accessor entry, so an
      // accessor-wrapped style value (`style={{ "pointer-events": () => ... }}`)
      // is actually invoked in this tracking scope and its signal gets
      // subscribed. `plainStyle` only checks each entry's type and never calls
      // it, so it would never re-run this effect for that form.
      resolveStyle(options().style);
      // Read here, in the tracking compute phase, not in the untracked apply
      // callback below.
      return element();
    },
    (node) => {
      if (node) noteStyleChange(node);
    },
    { defer: true },
  );

  const controller = createMotionController(
    toInitialValues(initialTarget),
    bound.values,
    layout,
  );
  onCleanup(controller.dispose);

  const fallbackTransition = createMemo(
    () => options().transition ?? config.transition,
  );

  // An exit layer only replaces keys it defines; other animate values remain.
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

  // Create the scope before the pass effect so children can wait on this element.
  const scope = createVariantScope(options, custom, () => merged().transition);

  createEffect(
    () => {
      const present = presence ? presence.isPresent() : true;
      const reducedMotion =
        config.reducedMotion === "always" ||
        (config.reducedMotion === "user" && prefersReducedMotion());

      const target = merged();
      const node = element();
      const current = options();

      // Resolved here, not in the apply step below: `sequencePass` reads
      // `orchestration()` on both scopes, which reads a `transition()` memo,
      // and a memo read from outside a tracking scope is exactly what Solid's
      // `STRICT_READ_UNTRACKED` warns about. `apply` is not a tracking scope;
      // this compute function is, so the read belongs here regardless of
      // whether the resulting object turns out to gate anything.
      const sequence = sequencePass(inherited, scope);

      return {
        present,
        definition: present ? definitionFor("animate") : definitionFor("exit"),
        target: reducedMotion ? withoutMovement(target) : target,
        fallbackTransition: fallbackTransition(),
        skipAnimations: config.skipAnimations ?? false,
        instantLayout: reducedMotion || (config.skipAnimations ?? false),
        // Read in the pass so sibling entry and exit changes restagger the row.
        delay: node && inherited ? inherited.delayFor(node) : 0,
        sequence,
        onAnimationStart: current.onAnimationStart,
        onAnimationComplete: current.onAnimationComplete,
        onUpdate: current.onUpdate,
      };
    },
    (next) => {
      const pass: MotionPass = {
        target: next.target,
        delay: next.delay,
        skipAnimations: next.skipAnimations,
        instantLayout: next.instantLayout,
        fallbackTransition: next.fallbackTransition,
        definition: next.definition,
        sequence: next.sequence?.begin,
        onAnimationStart: next.onAnimationStart,
        onAnimationComplete: next.onAnimationComplete,
        onUpdate: next.onUpdate,
      };

      if (next.present) {
        // Superseding an exit pass releases its presence hold.
        controller.run(pass, () => next.sequence?.settled());
        return;
      }

      // Take the new hold before `run`, which synchronously releases a superseded
      // pass and prevents the presence count from reaching zero between exits.
      const release = presence?.hold();
      controller.run(pass, () => {
        release?.();
        next.sequence?.settled();
      });
    },
  );

  // Bound values stay under the caller's control when a pass stops naming them.
  const painted = buildInitialRender(
    paintTarget(bound.painted, initialTarget),
    tag,
  );

  return {
    style: painted.style,
    attrs: painted.attrs,
    ref: (node) => {
      controller.mount(node);

      // Register during the render walk, not from an effect watching the node.
      // Solid settles every effect's compute function to a fixpoint before
      // committing any of their apply steps, so a sibling registering from an
      // apply callback is always too late for another sibling's compute in the
      // same mount: on the very first pass every child's delay computed
      // `children.size === 0` and a stagger never staggered. Registering here
      // runs before that compute phase, so every sibling mounted in the same
      // pass already has a position by the time one asks for its own.
      //
      // Refs run outside an owner, so restore the captured owner for cleanup.
      // A bare `onCleanup` here is silently discarded and the child never
      // leaves the registry.
      if (inherited) {
        const unregister = inherited.register(node);
        runWithOwner(owner, () => onCleanup(unregister));
      }

      setElement(node);
    },
    scope,
  };
}

/**
 * What the element is painted with on its first render: the values the caller
 * bound through `style`, with the initial target over the top.
 *
 * `undefined` when there is nothing to paint, so an element with neither keeps
 * an empty style object rather than picking up whatever an empty target builds.
 */
function paintTarget(
  painted: Record<string, string | number>,
  initialTarget: TargetAndTransition | undefined,
): TargetAndTransition | undefined {
  const hasBound = Object.keys(painted).length > 0;
  if (!hasBound) return initialTarget;
  return { ...painted, ...initialTarget };
}

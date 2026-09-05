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
import { plainStyle, readStyleValues } from "./motion-values";
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

  // Refs run outside an owner, so child cleanup needs the captured owner.
  const owner = getOwner();

  // Gestures read the node in a tracking scope, so keep it in a signal.
  const [element, setElement] = createSignal<HTMLElement | SVGElement>();
  const gestures = watchGestures(options, element);

  const inherited = useVariants();
  // This is the boundary where inherited and presence custom values become TCustom.
  const custom = (): TCustom | undefined =>
    (options().custom ?? inherited?.custom() ?? presence?.custom()) as
      | TCustom
      | undefined;

  // Inherit labels only when this element does not define the layer itself.
  const definitionFor = (layer: VariantLayer) => {
    const own = options()[layer];
    return own !== undefined ? own : inherited?.label(layer);
  };

  const resolveLayer = (layer: VariantLayer) =>
    resolveDefinition(definitionFor(layer), options().variants, custom());

  // The initial target describes the first paint, so resolve it once. A presence
  // boundary with `initial={false}` overrides the element's own option.
  const initialTarget = untrack(() =>
    resolveInitialDefinition({
      initial: presence?.initial() === false ? false : definitionFor("initial"),
      animate: definitionFor("animate"),
      variants: options().variants,
      custom: custom(),
    }),
  );

  // Read once. The bound keys describe the element; only their values change.
  const bound = untrack(() => readStyleValues(options().style));

  // Layout options describe the node, so capture them with the initial target.
  const layout = untrack((): LayoutOptions | undefined => {
    const current = options();
    if (!current.layout && current.layoutId === undefined) return undefined;
    return {
      layout: current.layout,
      layoutId: current.layoutId,
      style: plainStyle(current.style),
    };
  });

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

      // `sequencePass` reads reactive orchestration data, so resolve it in this
      // tracking scope rather than in the apply callback.
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

/** Combines caller-owned values with the initial target for the first render. */
function paintTarget(
  painted: Record<string, string | number>,
  initialTarget: TargetAndTransition | undefined,
): TargetAndTransition | undefined {
  const hasBound = Object.keys(painted).length > 0;
  if (!hasBound) return initialTarget;
  return { ...painted, ...initialTarget };
}

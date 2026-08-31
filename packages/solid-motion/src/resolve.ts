import { isKeyframesTarget, type ValueKeyframesDefinition } from "motion-dom";

import type {
  AnimationDefinition,
  TargetAndTransition,
  VariantMap,
} from "./types";

/**
 * Turns whatever the caller wrote into a single target: an inline target passes
 * through, a variant name is looked up, and an array is merged left to right so
 * later entries win. Returns `undefined` for "animate nothing", which is what
 * `false` and a missing definition both mean.
 */
export function resolveDefinition<TCustom>(
  definition: AnimationDefinition,
  variants: VariantMap<TCustom> | undefined,
  custom: TCustom | undefined,
): TargetAndTransition | undefined {
  if (definition === false || definition === undefined) return undefined;

  if (Array.isArray(definition)) {
    return definition.reduce<TargetAndTransition | undefined>(
      (resolved, item) =>
        mergeTargets(resolved, resolveDefinition(item, variants, custom)),
      undefined,
    );
  }

  if (typeof definition === "string") {
    const variant = variants?.[definition];
    if (!variant) return undefined;
    return typeof variant === "function" ? variant(custom as TCustom) : variant;
  }

  return definition;
}

function mergeTargets(
  current: TargetAndTransition | undefined,
  next: TargetAndTransition | undefined,
): TargetAndTransition | undefined {
  if (!current) return next;
  if (!next) return current;
  return {
    ...current,
    ...next,
    transition: next.transition ?? current.transition,
    transitionEnd: {
      ...current.transitionEnd,
      ...next.transitionEnd,
    },
  };
}

export interface InitialDefinition<TCustom> {
  initial: AnimationDefinition;
  animate: AnimationDefinition;
  variants: VariantMap<TCustom> | undefined;
  custom: TCustom | undefined;
}

/**
 * The target the element is rendered with. `initial={false}` renders the animate
 * target directly, which is how "do not play an entrance" is expressed: the
 * element is born where the animation would have ended, so the pass that follows
 * has nothing left to move.
 */
export function resolveInitialDefinition<TCustom>(
  props: InitialDefinition<TCustom>,
): TargetAndTransition | undefined {
  const blocked = props.initial === false;
  const definition = blocked ? props.animate : props.initial;
  const target = resolveDefinition(definition, props.variants, props.custom);

  return target && collapseKeyframes(target, blocked ? "last" : "first");
}

/**
 * Which keyframe of a `[0, 0.5, 1]` array describes the element as rendered.
 * Normally the first, since that is where the animation starts. When the
 * entrance is blocked the element is born where the blocked animation would
 * have ended, so the last.
 */
type KeyframeEdge = "first" | "last";

/**
 * Reduces every keyframe array in a target to the one value the element is
 * actually born carrying.
 *
 * This is the sole owner of that rule, so nothing downstream has to know
 * keyframe arrays exist: `buildInitialRender` handed `{ x: [0, 100] }` produced
 * `transform: none` and an `opacity` of the literal string `0,1`, because a CSS
 * builder has no reading of an array. The server emitted that markup and the
 * client painted it, and then the animation corrected it a frame later.
 *
 * `null` inside an array means "carry on from wherever this value already is",
 * which describes no rendered value at all, so such a key is left out.
 */
function collapseKeyframes(
  target: TargetAndTransition,
  edge: KeyframeEdge,
): TargetAndTransition {
  const { transition, transitionEnd, ...values } = target;
  const collapsed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    const keyframes = value as ValueKeyframesDefinition;
    const resolved = isKeyframesTarget(keyframes)
      ? keyframes[edge === "first" ? 0 : keyframes.length - 1]
      : keyframes;

    if (resolved === null || resolved === undefined) continue;
    collapsed[key] = resolved;
  }

  return { ...collapsed, transition, transitionEnd } as TargetAndTransition;
}

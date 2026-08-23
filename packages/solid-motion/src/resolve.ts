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
  initial: AnimationDefinition | true;
  animate: AnimationDefinition;
  variants: VariantMap<TCustom> | undefined;
  custom: TCustom | undefined;
}

/**
 * The target the element is rendered with. Both `initial={false}` and
 * `initial={true}` render the animate target directly, which is how "do not
 * play an entrance" is expressed: the element is born where the animation
 * would have ended, so the pass that follows has nothing left to move.
 */
export function resolveInitialDefinition<TCustom>(
  props: InitialDefinition<TCustom>,
): TargetAndTransition | undefined {
  const definition =
    props.initial === false || props.initial === true
      ? props.animate
      : props.initial;

  return resolveDefinition(definition, props.variants, props.custom);
}

export function stripAnimationOptions(
  target: TargetAndTransition | undefined,
): TargetAndTransition | undefined {
  if (!target) return undefined;
  const {
    transition: _transition,
    transitionEnd: _transitionEnd,
    ...values
  } = target;
  return values;
}

import type { ComponentProps, JSX } from "@solidjs/web";
import type { TargetAndTransition, Transition } from "motion-dom";
import type { Element as SolidElement } from "solid-js";

export type { TargetAndTransition, Transition } from "motion-dom";

export type VariantDefinition<TCustom = unknown> =
  | TargetAndTransition
  | ((custom: TCustom) => TargetAndTransition);

export type VariantMap<TCustom = unknown> = Record<
  string,
  VariantDefinition<TCustom>
>;

export type AnimationDefinition =
  | false
  | string
  | string[]
  | TargetAndTransition
  | undefined;

export interface MotionConfigState {
  reducedMotion?: "always" | "never" | "user";
  transition?: Transition;
  skipAnimations?: boolean;
}

/**
 * What a presence boundary offers the elements inside it. `hold` is the whole
 * exit protocol: take one while animating out, call the returned release on
 * every terminal path, and the boundary unmounts the item when the count
 * reaches zero.
 */
export interface PresenceScope {
  isPresent: () => boolean;
  initial: () => boolean | undefined;
  custom: () => unknown;
  hold: () => () => void;
}

type MotionPropKeys =
  | "animate"
  | "custom"
  | "exit"
  | "initial"
  | "onAnimationComplete"
  | "onAnimationStart"
  | "onUpdate"
  | "style"
  | "transition"
  | "variants"
  | "whileFocus"
  | "whileHover"
  | "whilePress"
  | "ref";

export interface MotionProps<TCustom = unknown> extends Omit<
  ComponentProps<"div">,
  MotionPropKeys
> {
  animate?: AnimationDefinition;
  custom?: TCustom;
  exit?: AnimationDefinition;
  initial?: AnimationDefinition | true;
  /** Applied while the element has a visible focus ring. */
  whileFocus?: AnimationDefinition;
  /** Applied while a non-touch pointer is over the element. */
  whileHover?: AnimationDefinition;
  /** Applied while the element is pressed, including by Enter on a keyboard. */
  whilePress?: AnimationDefinition;
  onAnimationComplete?: (definition: AnimationDefinition) => void;
  onAnimationStart?: (definition: AnimationDefinition) => void;
  onUpdate?: (latest: Record<string, unknown>) => void;
  style?: JSX.CSSProperties | Record<string, unknown>;
  transition?: Transition;
  variants?: VariantMap<TCustom>;
  ref?: JSX.Ref<unknown>;
  children?: SolidElement;
}

export type MotionComponent<TProps extends object = Record<string, unknown>> = (
  props: TProps,
) => SolidElement;

export type MotionProxy = {
  [K in keyof JSX.IntrinsicElements]: MotionComponent<
    Omit<JSX.IntrinsicElements[K], MotionPropKeys> & MotionProps
  >;
} & {
  create: <TProps extends object>(
    component: MotionComponent<TProps>,
  ) => MotionComponent<TProps & MotionProps>;
};

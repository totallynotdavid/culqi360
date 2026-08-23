import type { ComponentProps, JSX } from "@solidjs/web";
import type { TargetAndTransition, Transition } from "motion-dom";
import type { Element as SolidElement } from "solid-js";

export type { TargetAndTransition, Transition } from "motion-dom";

export type MotionTarget = TargetAndTransition;

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

export interface PresenceContextValue {
  id: string;
  isPresent: () => boolean;
  initial?: () => boolean | undefined;
  custom?: () => unknown;
  onExitComplete?: (childId: string) => void;
  register: (childId: string) => () => void;
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
  | "ref";

export interface MotionProps<TCustom = unknown> extends Omit<
  ComponentProps<"div">,
  MotionPropKeys
> {
  animate?: AnimationDefinition;
  custom?: TCustom;
  exit?: AnimationDefinition;
  initial?: AnimationDefinition | true;
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

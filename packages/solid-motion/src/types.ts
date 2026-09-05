import type { ComponentProps, JSX } from "@solidjs/web";
import type { MotionValue, TargetAndTransition, Transition } from "motion-dom";
import type { Element as SolidElement } from "solid-js";

import type { ViewportOptions } from "./gestures";
import type { LayoutOption } from "./projection";

export type { MotionValue, TargetAndTransition, Transition } from "motion-dom";

/**
 * A style entry motion writes itself on the animation frame instead of handing
 * to the DOM: a value the caller holds, or a Solid accessor to carry across.
 */
export type MotionStyleValue = MotionValue | (() => string | number);

/** Plain CSS, with any entry optionally replaced by a value motion drives. */
export type MotionStyle =
  | JSX.CSSProperties
  | Record<string, string | number | MotionStyleValue | undefined>;
export type { ViewportOptions } from "./gestures";

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
  | "layout"
  | "layoutId"
  | "onAnimationComplete"
  | "onAnimationStart"
  | "onUpdate"
  | "style"
  | "transition"
  | "variants"
  | "whileFocus"
  | "whileHover"
  | "whileInView"
  | "whilePress"
  | "viewport"
  | "ref";

/**
 * How an element animates, with nothing about how it is rendered. This is what
 * `createMotion` takes; `MotionProps` is this plus the element's own attributes.
 */
export interface MotionOptions<TCustom = unknown> {
  animate?: AnimationDefinition;
  custom?: TCustom;
  exit?: AnimationDefinition;
  initial?: AnimationDefinition;
  /**
   * Animates layout changes. `true` covers position and size; string values
   * narrow it.
   */
  layout?: LayoutOption;
  /**
   * Shares and crossfades layout transitions with matching elements, including
   * across `AnimatePresence`.
   */
  layoutId?: string;
  /** Applied while the element has a visible focus ring. */
  whileFocus?: AnimationDefinition;
  /** Applied while the element is inside the viewport. */
  whileInView?: AnimationDefinition;
  /** Tunes what `whileInView` counts as visible. */
  viewport?: ViewportOptions;
  /** Applied while a non-touch pointer is over the element. */
  whileHover?: AnimationDefinition;
  /** Applied while the element is pressed, including by Enter on a keyboard. */
  whilePress?: AnimationDefinition;
  onAnimationComplete?: (definition: AnimationDefinition) => void;
  onAnimationStart?: (definition: AnimationDefinition) => void;
  onUpdate?: (latest: Record<string, unknown>) => void;
  /**
   * Plain CSS, except that any entry may be a `MotionValue` or a Solid accessor.
   * Those are bound to the element and written on the frame loop, so they move
   * without re-rendering, and naming the same key in `animate` animates them.
   */
  style?: MotionStyle;
  transition?: Transition;
  variants?: VariantMap<TCustom>;
}

export interface MotionProps<TCustom = unknown>
  extends MotionOptions<TCustom>, Omit<ComponentProps<"div">, MotionPropKeys> {
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

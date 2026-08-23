import { Dynamic, type JSX } from "@solidjs/web";
import { positionalKeys } from "motion-dom";
import {
  createEffect,
  createMemo,
  merge,
  omit,
  onCleanup,
  untrack,
} from "solid-js";

import { useMotionConfig } from "./config";
import { createMotionController, type MotionPass } from "./controller";
import { buildInitialStyle } from "./initial";
import { usePresence, usePresenceContext } from "./presence";
import { useReducedMotion } from "./reduced-motion";
import {
  resolveDefinition,
  resolveInitialDefinition,
  stripAnimationOptions,
} from "./resolve";
import type {
  MotionComponent,
  MotionProps,
  MotionProxy,
  TargetAndTransition,
  Transition,
} from "./types";

const motionPropKeys = [
  "animate",
  "custom",
  "exit",
  "initial",
  "onAnimationComplete",
  "onAnimationStart",
  "onUpdate",
  "ref",
  "style",
  "transition",
  "variants",
] as const;

type MotionHost =
  | keyof JSX.IntrinsicElements
  | ((props: Record<string, unknown>) => JSX.Element);

function createMotionComponent<TProps extends object>(host: MotionHost) {
  return (props: TProps & MotionProps): JSX.Element => {
    const [isPresent, safeToRemove] = usePresence();
    const prefersReducedMotion = useReducedMotion();
    const config = useMotionConfig();
    const presence = usePresenceContext();
    const controller = createMotionController();
    onCleanup(controller.dispose);

    const custom = () => props.custom ?? presence?.custom?.();

    // The initial target is resolved exactly once. It describes the element the
    // browser is handed, so re-resolving it later would describe a paint that
    // already happened. A boundary-level `initial={false}` wins over the
    // element's own prop: it means "this subtree was already on screen".
    const initialTarget = untrack(() =>
      resolveInitialDefinition({
        initial: presence?.initial?.() === false ? false : props.initial,
        animate: props.animate,
        variants: props.variants,
        custom: custom(),
      }),
    );
    const initialValues = untrack(() =>
      toRawValues(stripAnimationOptions(initialTarget)),
    );
    const initialStyle = buildInitialStyle(initialTarget);

    const style = createMemo(
      () => merge(props.style ?? {}, initialStyle) as JSX.CSSProperties,
    );
    const forwarded = omit(props, ...motionPropKeys);

    createEffect(
      () => {
        const present = isPresent();
        const definition = present ? props.animate : props.exit;
        const reducedMotion =
          config.reducedMotion === "always" ||
          (config.reducedMotion === "user" && prefersReducedMotion());

        return {
          present,
          definition,
          target: resolveDefinition(definition, props.variants, custom()),
          transition: withConfig(
            props.transition ?? config.transition,
            config.skipAnimations ?? false,
          ),
          reducedMotion,
          onAnimationStart: props.onAnimationStart,
          onAnimationComplete: props.onAnimationComplete,
          onUpdate: props.onUpdate,
        };
      },
      (next) => {
        const pass: MotionPass = {
          target: applyReducedMotion(next.target, next.reducedMotion),
          initialValues,
          transition: next.transition,
          definition: next.definition,
          onAnimationStart: next.onAnimationStart,
          onAnimationComplete: next.onAnimationComplete,
          onUpdate: next.onUpdate,
        };

        // While present, nothing is waiting on the animation. While exiting,
        // the presence boundary is: it may only unmount once this pass reached
        // its target, never when a re-entry superseded it.
        controller.run(
          pass,
          next.present
            ? undefined
            : (completed) => {
                if (completed) safeToRemove?.();
              },
        );
      },
    );

    const DynamicComponent = Dynamic as unknown as (
      props: Record<string, unknown>,
    ) => JSX.Element;
    return (
      <DynamicComponent
        component={host}
        {...forwarded}
        style={style()}
        ref={[
          (element: unknown) => controller.mount(element as HTMLElement),
          props.ref,
        ]}
      />
    );
  };
}

/**
 * Motion's reduced-motion contract is not "do not animate". Positional and
 * layout properties jump; opacity, colour and the rest still animate, because
 * those are the ones that carry meaning rather than movement.
 */
function applyReducedMotion(
  target: TargetAndTransition | undefined,
  reducedMotion: boolean,
): TargetAndTransition | undefined {
  if (!reducedMotion || !target) return target;

  const { transition, transitionEnd, ...values } = target;
  const perValue: Record<string, unknown> = {};
  for (const key of Object.keys(values)) {
    if (positionalKeys.has(key)) perValue[key] = { type: false };
  }

  return {
    ...values,
    transitionEnd,
    transition: { ...transition, ...perValue },
  } as TargetAndTransition;
}

function withConfig(
  transition: Transition | undefined,
  skipAnimations: boolean,
): Transition | undefined {
  if (!skipAnimations) return transition;
  return { ...transition, skipAnimations } as Transition;
}

/**
 * The raw target values, kept out of `buildInitialStyle`'s CSS output. An
 * animation starting from `x` needs the number `20`, not the string `20px`.
 */
function toRawValues(
  target: TargetAndTransition | undefined,
): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  if (!target) return values;
  for (const [key, value] of Object.entries(target)) {
    if (typeof value === "string" || typeof value === "number") {
      values[key] = value;
    }
  }
  return values;
}

const componentCache = new Map<string, MotionComponent>();
const createCustomMotion = <TProps extends object>(
  component: MotionComponent<TProps>,
) =>
  createMotionComponent<TProps>(
    component as unknown as (props: Record<string, unknown>) => JSX.Element,
  );

export const motion = new Proxy(
  { create: createCustomMotion },
  {
    get(target, key: string) {
      if (key === "create") return target.create;
      if (!componentCache.has(key)) {
        componentCache.set(
          key,
          createMotionComponent<Record<string, unknown>>(
            key as keyof JSX.IntrinsicElements,
          ),
        );
      }
      return componentCache.get(key);
    },
  },
) as unknown as MotionProxy;

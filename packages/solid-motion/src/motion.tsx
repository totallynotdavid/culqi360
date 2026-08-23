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
import { usePresence } from "./presence";
import { useReducedMotion } from "./reduced-motion";
import { resolveDefinition, resolveInitialDefinition } from "./resolve";
import { mergeLayers, type MergedTarget } from "./target";
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
    const prefersReducedMotion = useReducedMotion();
    const config = useMotionConfig();
    const presence = usePresence();
    const controller = createMotionController();
    onCleanup(controller.dispose);

    const custom = () => props.custom ?? presence?.custom();

    // The initial target is resolved exactly once. It describes the element the
    // browser is handed, so re-resolving it later would describe a paint that
    // already happened. A boundary-level `initial={false}` wins over the
    // element's own prop: it means "this subtree was already on screen".
    const initialTarget = untrack(() =>
      resolveInitialDefinition({
        initial: presence?.initial() === false ? false : props.initial,
        animate: props.animate,
        variants: props.variants,
        custom: custom(),
      }),
    );
    const initialValues = toRawValues(initialTarget);
    const initialStyle = buildInitialStyle(initialTarget);

    const style = createMemo(
      () => merge(props.style ?? {}, initialStyle) as JSX.CSSProperties,
    );
    const forwarded = omit(props, ...motionPropKeys);

    createEffect(
      () => {
        const present = presence ? presence.isPresent() : true;
        const fallbackTransition = withConfig(
          props.transition ?? config.transition,
          config.skipAnimations ?? false,
        );
        const reducedMotion =
          config.reducedMotion === "always" ||
          (config.reducedMotion === "user" && prefersReducedMotion());

        // `exit` sits on top of `animate` rather than replacing it, so a key
        // `animate` owns and `exit` says nothing about keeps its animated value
        // instead of falling back on the way out.
        const target = mergeLayers(
          [
            {
              target: resolveDefinition(
                props.animate,
                props.variants,
                custom(),
              ),
              active: true,
            },
            {
              target: resolveDefinition(props.exit, props.variants, custom()),
              active: !present,
            },
          ],
          fallbackTransition,
        );

        return {
          present,
          definition: present ? props.animate : props.exit,
          target: reducedMotion ? withoutMovement(target) : target,
          fallbackTransition,
          onAnimationStart: props.onAnimationStart,
          onAnimationComplete: props.onAnimationComplete,
          onUpdate: props.onUpdate,
        };
      },
      (next) => {
        const pass: MotionPass = {
          target: next.target,
          initialValues,
          fallbackTransition: next.fallbackTransition,
          definition: next.definition,
          onAnimationStart: next.onAnimationStart,
          onAnimationComplete: next.onAnimationComplete,
          onUpdate: next.onUpdate,
        };

        if (next.present) {
          // Superseding an exit pass releases the hold that pass was carrying,
          // so returning to the screen needs no bookkeeping of its own.
          controller.run(pass);
          return;
        }

        // Each pass owns exactly one hold and releases exactly that one. A
        // shared variable cannot do this: `run` synchronously settles the pass
        // it replaces, so a callback reading the current hold would release the
        // one just taken and drop the boundary's count to zero mid-exit.
        //
        // Taking the hold before `run` is what keeps the count from touching
        // zero between two passes of the same exit.
        const release = presence?.hold();
        controller.run(pass, () => release?.());
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
function withoutMovement(target: MergedTarget): MergedTarget {
  const entries = new Map(target.entries);
  for (const [key, entry] of entries) {
    if (!positionalKeys.has(key)) continue;
    entries.set(key, { ...entry, transition: { type: false } as Transition });
  }
  return { entries, transitionEnd: target.transitionEnd };
}

function withConfig(
  transition: Transition | undefined,
  skipAnimations: boolean,
): Transition | undefined {
  if (!skipAnimations) return transition;
  return { ...transition, skipAnimations } as Transition;
}

/**
 * The same values `buildInitialStyle` renders, but raw rather than as CSS: an
 * animation starting from `x` needs the number `20`, not the string `20px`.
 * `transitionEnd` is folded in for the same reason it is there, since on the
 * initial pass there is no transition for it to land after.
 */
function toRawValues(
  target: TargetAndTransition | undefined,
): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  if (!target) return values;

  const { transition: _transition, transitionEnd, ...rest } = target;
  for (const [key, value] of Object.entries({ ...rest, ...transitionEnd })) {
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

import { Dynamic, type JSX } from "@solidjs/web";
import { createMemo, merge, omit } from "solid-js";

import { createMotion } from "./create-motion";
import { gestureNames } from "./gestures";
import { plainStyle } from "./motion-values";
import type { MotionComponent, MotionProps, MotionProxy } from "./types";
import { VariantContext } from "./variants";

const motionPropKeys = [
  "animate",
  "custom",
  "exit",
  "initial",
  "layout",
  "layoutId",
  "onAnimationComplete",
  "onAnimationStart",
  "onUpdate",
  "ref",
  "style",
  "transition",
  "variants",
  "viewport",
  ...gestureNames,
] as const;

type MotionHost =
  | keyof JSX.IntrinsicElements
  | ((props: Record<string, unknown>) => JSX.Element);

/**
 * The ergonomic layer over `createMotion`, and nothing more than that.
 *
 * What it adds over calling the primitive is a component boundary and a prop
 * spread, so every attribute is applied by runtime diffing instead of the
 * static setters Solid's compiler emits for a literal element. That cost is
 * bounded and worth paying for the familiar API. What it adds that the
 * primitive cannot is the variant scope: descendants read it from context, and
 * only a component can render them inside a provider.
 */
function createMotionComponent<TProps extends object>(host: MotionHost) {
  const tag = typeof host === "string" ? host : undefined;

  return (props: TProps & MotionProps): JSX.Element => {
    const motion = createMotion(() => props, tag);
    const forwarded = omit(props, ...motionPropKeys);
    const style = createMemo(
      () => merge(plainStyle(props.style), motion.style) as JSX.CSSProperties,
    );

    const DynamicComponent = Dynamic as unknown as (
      props: Record<string, unknown>,
    ) => JSX.Element;
    // Render lazily so descendants are created inside the variant provider.
    const renderElement = () => (
      <DynamicComponent
        component={host}
        {...forwarded}
        {...motion.attrs}
        style={style()}
        ref={[motion.ref, props.ref]}
      />
    );

    if (!motion.scope) return renderElement();
    return (
      <VariantContext value={motion.scope}>{renderElement()}</VariantContext>
    );
  };
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

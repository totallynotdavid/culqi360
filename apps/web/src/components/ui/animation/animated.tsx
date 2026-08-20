import { createEffect, createRenderEffect, merge, onCleanup, onSettled, splitProps, useContext } from "solid-js";
import { type JSX } from "@solidjs/web";

import { PresenceContext } from "./presence-context";
import { usePresence } from "./use-presence";

type MotionValue = number | string;
type MotionTarget = {
  opacity?: number;
  x?: MotionValue;
  y?: MotionValue;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: MotionValue;
};

type MotionVariants = Record<string, MotionTarget>;

interface MotionTransition {
  duration?: number;
  ease?: string;
  delay?: number;
}

interface AnimatedProps extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  key?: string | number;
  children?: JSX.Element;
  variants?: MotionVariants;
  initial?: false | string | MotionTarget;
  animate?: string | MotionTarget;
  exit?: string | MotionTarget;
  transition?: MotionTransition;
  layout?: boolean;
}

function hasTransformProps(target: MotionTarget | undefined): boolean {
  return Boolean(
    target &&
    (target.x !== undefined ||
      target.y !== undefined ||
      target.scale !== undefined ||
      target.scaleX !== undefined ||
      target.scaleY !== undefined ||
      target.rotate !== undefined),
  );
}

function transitionToOptions(
  transition: MotionTransition,
): KeyframeAnimationOptions {
  return {
    duration: Math.max(0, (transition.duration ?? 0.3) * 1000),
    delay: Math.max(0, (transition.delay ?? 0) * 1000),
    easing: transition.ease ?? "cubic-bezier(0.22, 1, 0.36, 1)",
    fill: "forwards",
  };
}

export function Animated(inputProps: AnimatedProps) {
  const props = merge({ transition: {} }, inputProps);
  const [isPresent, safeToRemove] = usePresence();
  const presenceContext = useContext(PresenceContext);
  const [local, domProps] = splitProps(props, [
    "children",
    "variants",
    "initial",
    "animate",
    "exit",
    "transition",
    "layout",
    "style",
  ]);

  let el: HTMLDivElement | undefined;
  let activeAnimation: Animation | undefined;
  let didMount = false;
  let previousRect: DOMRect | undefined;

  const stopAnimation = () => {
    activeAnimation?.cancel();
    activeAnimation = undefined;
  };

  const resolveTarget = (
    definition: false | string | string[] | MotionTarget | undefined,
  ): MotionTarget | undefined => {
    if (definition === false || definition === undefined) {
      return undefined;
    }
    if (typeof definition === "string") {
      return local.variants?.[definition];
    }
    if (Array.isArray(definition)) {
      for (const label of definition) {
        const target = local.variants?.[label];
        if (target) {
          return target;
        }
      }
      return undefined;
    }
    return definition;
  };

  const targetToFrame = (target: MotionTarget | undefined): Keyframe => {
    if (!target) {
      return {};
    }
    const transforms: string[] = [];
    if (target.x !== undefined) {
      transforms.push(`translateX(${formatUnit(target.x)})`);
    }
    if (target.y !== undefined) {
      transforms.push(`translateY(${formatUnit(target.y)})`);
    }
    if (target.scale !== undefined) {
      transforms.push(`scale(${target.scale})`);
    }
    if (target.scaleX !== undefined) {
      transforms.push(`scaleX(${target.scaleX})`);
    }
    if (target.scaleY !== undefined) {
      transforms.push(`scaleY(${target.scaleY})`);
    }
    if (target.rotate !== undefined) {
      transforms.push(`rotate(${formatUnit(target.rotate, "deg")})`);
    }

    const frame: Keyframe = {};
    if (target.opacity !== undefined) {
      frame.opacity = String(target.opacity);
    }
    if (transforms.length > 0) {
      frame.transform = transforms.join(" ");
    }
    return frame;
  };

  const applyTarget = (target: MotionTarget | undefined) => {
    if (!el || !target) {
      return;
    }
    if (target.opacity !== undefined) {
      el.style.opacity = String(target.opacity);
    }
    const frame = targetToFrame(target);
    if (frame.transform) {
      el.style.transform = String(frame.transform);
    }
  };

  const animateTo = (
    toTarget: MotionTarget | undefined,
    fromTarget?: MotionTarget,
    onFinish?: () => void,
  ) => {
    if (!el) {
      return;
    }
    if (!toTarget) {
      onFinish?.();
      return;
    }
    stopAnimation();
    const toFrame = targetToFrame(toTarget);
    const fromFrame = targetToFrame(fromTarget);
    const fromComputed: Keyframe = {};
    if (fromFrame.opacity === undefined) {
      fromComputed.opacity = getComputedStyle(el).opacity;
    }
    if (fromFrame.transform === undefined) {
      const computedTransform = getComputedStyle(el).transform;
      fromComputed.transform =
        computedTransform === "none"
          ? "translateX(0px) translateY(0px)"
          : computedTransform;
    }

    const startAnimation = () => {
      if (!el) {
        return;
      }
      activeAnimation = el.animate(
        [{ ...fromComputed, ...fromFrame }, toFrame],
        transitionToOptions(local.transition),
      );
      activeAnimation.onfinish = () => {
        applyTarget(toTarget);
        onFinish?.();
      };
    };

    if (fromTarget) {
      applyTarget(fromTarget);
      requestAnimationFrame(startAnimation);
      return;
    }

    startAnimation();
  };

  const runLayoutAnimation = () => {
    if (!el || !local.layout) {
      return;
    }
    const animateTarget = resolveTarget(local.animate);
    const initialTarget = resolveTarget(local.initial);
    const exitTarget = resolveTarget(local.exit);
    if (
      hasTransformProps(animateTarget) ||
      hasTransformProps(initialTarget) ||
      hasTransformProps(exitTarget)
    ) {
      previousRect = el.getBoundingClientRect();
      return;
    }
    const nextRect = el.getBoundingClientRect();
    if (previousRect) {
      const dx = previousRect.left - nextRect.left;
      const dy = previousRect.top - nextRect.top;
      if (dx !== 0 || dy !== 0) {
        stopAnimation();
        activeAnimation = el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0px, 0px)" },
          ],
          transitionToOptions(local.transition),
        );
      }
    }
    previousRect = nextRect;
  };

  createRenderEffect(runLayoutAnimation);

  createEffect(() => {
    if (!el) {
      return;
    }

    const currentPresent = isPresent();
    const initialFromPresence = presenceContext?.initial;
    const initialDef = local.initial ?? initialFromPresence;
    const animateDef = local.animate;
    const exitDef = local.exit;

    if (!currentPresent) {
      const exitTarget = resolveTarget(exitDef);
      animateTo(exitTarget, undefined, () => safeToRemove?.());
      return;
    }

    const animateTarget = resolveTarget(animateDef);
    if (!didMount) {
      didMount = true;
      if (initialDef === false) {
        applyTarget(animateTarget);
        return;
      }
      const initialTarget = resolveTarget(initialDef);
      animateTo(animateTarget, initialTarget);
      return;
    }

    animateTo(animateTarget);
  });

  onSettled(runLayoutAnimation);
  onCleanup(stopAnimation);

  return (
    <div
      {...domProps}
      ref={(node) => {
        el = node;
        const forwardedRef = domProps.ref;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        }
      }}
      style={local.style}
    >
      {local.children}
    </div>
  );
}

function formatUnit(value: MotionValue, unit = "px"): string {
  if (typeof value === "number") {
    return `${value}${unit}`;
  }
  return value;
}

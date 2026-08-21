import { type JSX } from "@solidjs/web";
import {
  createEffect,
  createRenderEffect,
  merge,
  onCleanup,
  onSettled,
  omit,
  useContext,
} from "solid-js";

import { animate as runAnimation } from "./animate";
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
  const domProps = omit(
    props,
    "children",
    "variants",
    "initial",
    "animate",
    "exit",
    "transition",
    "layout",
    "style",
  );

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
      return props.variants?.[definition];
    }
    if (Array.isArray(definition)) {
      for (const label of definition) {
        const target = props.variants?.[label];
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
      activeAnimation = runAnimation(
        el,
        [{ ...fromComputed, ...fromFrame }, toFrame],
        transitionToOptions(props.transition),
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
    if (!el || !props.layout) {
      return;
    }
    const animateTarget = resolveTarget(props.animate);
    const initialTarget = resolveTarget(props.initial);
    const exitTarget = resolveTarget(props.exit);
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
        activeAnimation = runAnimation(
          el,
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0px, 0px)" },
          ],
          transitionToOptions(props.transition),
        );
      }
    }
    previousRect = nextRect;
  };

  // The layout pass has no reactive input of its own: it compares the
  // element's box against the previous one, so it runs on every render.
  createRenderEffect(
    () => props.layout,
    () => {
      runLayoutAnimation();
    },
  );

  createEffect(
    () => ({
      present: isPresent(),
      initial: props.initial ?? presenceContext?.initial,
      animate: props.animate,
      exit: props.exit,
    }),
    ({ present, initial, animate, exit }) => {
      if (!el) {
        return;
      }

      if (!present) {
        animateTo(resolveTarget(exit), undefined, () => safeToRemove?.());
        return;
      }

      const animateTarget = resolveTarget(animate);

      if (!didMount) {
        didMount = true;

        if (initial === false) {
          applyTarget(animateTarget);
          return;
        }

        animateTo(animateTarget, resolveTarget(initial));
        return;
      }

      animateTo(animateTarget);
    },
  );

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
      style={props.style}
    >
      {props.children}
    </div>
  );
}

function formatUnit(value: MotionValue, unit = "px"): string {
  if (typeof value === "number") {
    return `${value}${unit}`;
  }
  return value;
}

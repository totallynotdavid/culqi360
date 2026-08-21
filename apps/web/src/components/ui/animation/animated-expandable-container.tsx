import { type JSX } from "@solidjs/web";
import { createEffect, onCleanup } from "solid-js";

import { animate } from "./animate";

interface AnimatedExpandableContainerProps {
  isExpanded: boolean;
  children: JSX.Element;
  duration?: number;
  opacityDuration?: number;
}

const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

export function AnimatedExpandableContainer(
  props: AnimatedExpandableContainerProps,
) {
  let element: HTMLDivElement | undefined;
  let heightAnimation: Animation | undefined;
  let opacityAnimation: Animation | undefined;
  let initialized = false;

  createEffect(
    () => props.isExpanded,
    (isExpanded) => {
      if (!element) {
        return;
      }

      if (!initialized) {
        initialized = true;
        return;
      }

      const duration = props.duration ?? 300;
      const opacityDuration = props.opacityDuration ?? duration;
      const currentHeight = element.getBoundingClientRect().height;
      const currentOpacity = getComputedStyle(element).opacity;
      const targetHeight = isExpanded ? element.scrollHeight : 0;

      heightAnimation?.cancel();
      opacityAnimation?.cancel();

      element.style.height = `${currentHeight}px`;
      element.style.overflow = "hidden";
      element.style.opacity = currentOpacity;
      element.style.pointerEvents = isExpanded ? "" : "none";

      const nextHeightAnimation = animate(
        element,
        [{ height: `${currentHeight}px` }, { height: `${targetHeight}px` }],
        { duration, easing: EASING, fill: "forwards" },
      );

      const nextOpacityAnimation = animate(
        element,
        [{ opacity: currentOpacity }, { opacity: isExpanded ? "1" : "0" }],
        { duration: opacityDuration, easing: EASING, fill: "forwards" },
      );

      heightAnimation = nextHeightAnimation;
      opacityAnimation = nextOpacityAnimation;

      // Cancelled animations do not fire `onfinish`, so only the latest pair
      // can settle the element.
      let finishedAnimations = 0;

      const settleWhenBothFinish = () => {
        finishedAnimations += 1;

        if (finishedAnimations < 2 || !element) {
          return;
        }

        element.style.height = isExpanded ? "auto" : "0px";
        element.style.overflow = isExpanded ? "" : "hidden";
        element.style.opacity = isExpanded ? "" : "0";

        nextHeightAnimation.cancel();
        nextOpacityAnimation.cancel();
      };

      nextHeightAnimation.onfinish = settleWhenBothFinish;
      nextOpacityAnimation.onfinish = settleWhenBothFinish;
    },
  );

  onCleanup(() => {
    heightAnimation?.cancel();
    opacityAnimation?.cancel();
  });

  return (
    <div
      ref={(value) => (element = value)}
      style={{
        height: props.isExpanded ? "auto" : "0px",
        overflow: props.isExpanded ? "visible" : "hidden",
        opacity: props.isExpanded ? "1" : "0",
        "pointer-events": props.isExpanded ? "auto" : "none",
      }}
    >
      {props.children}
    </div>
  );
}

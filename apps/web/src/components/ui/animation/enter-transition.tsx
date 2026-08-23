import { type JSX } from "@solidjs/web";
import { onCleanup, onSettled } from "solid-js";

import { animate } from "./animate";

interface EnterTransitionProps {
  children: JSX.Element;
}

const ENTER_DURATION_MS = 280;
const ENTER_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

export function EnterTransition(props: EnterTransitionProps) {
  let containerRef: HTMLDivElement | null = null;
  let animation: Animation | undefined;

  onSettled(() => {
    if (typeof window === "undefined" || !containerRef) {
      return;
    }

    const element = containerRef;
    const targetHeight = element.scrollHeight;

    element.style.opacity = "0";
    element.style.height = "0px";
    element.style.overflow = "hidden";

    requestAnimationFrame(() => {
      animation = animate(
        element,
        [
          { opacity: 0, height: "0px" },
          { opacity: 1, height: `${targetHeight}px` },
        ],
        {
          duration: ENTER_DURATION_MS,
          easing: ENTER_EASING,
          fill: "forwards",
        },
      );

      animation.onfinish = () => {
        element.style.opacity = "1";
        element.style.height = "auto";
        element.style.overflow = "visible";
      };
    });
  });

  onCleanup(() => {
    animation?.cancel();
  });

  return (
    <div ref={(element) => (containerRef = element)}>{props.children}</div>
  );
}

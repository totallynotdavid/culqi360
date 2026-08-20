import { type JSX } from "@solidjs/web";

import { Animated } from "~/components/ui/animation/animated";

const SLIDE_OFFSET_PX = 12;
const STAGGER_DELAY_S = 0.07;
const NORMAL_DURATION_S = 0.3;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface OnboardingStepAnimatedItemProps {
  index: number;
  children: JSX.Element;
  class?: string;
}

export function OnboardingStepAnimatedItem(
  props: OnboardingStepAnimatedItemProps,
) {
  const reduce = prefersReducedMotion();

  return (
    <Animated
      class={props.class}
      style={{ "max-width": "100%" }}
      initial={{ opacity: 0, y: reduce ? 0 : SLIDE_OFFSET_PX }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduce ? 0 : NORMAL_DURATION_S,
        ease: "ease-in-out",
        delay: reduce ? 0 : props.index * STAGGER_DELAY_S,
      }}
    >
      {props.children}
    </Animated>
  );
}

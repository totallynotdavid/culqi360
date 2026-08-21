import { type JSX } from "@solidjs/web";

import { Animated } from "~/components/ui/animation/animated";

const SLIDE_OFFSET_PX = 12;
const STAGGER_DELAY_S = 0.07;
const NORMAL_DURATION_S = 0.3;

interface OnboardingStepAnimatedItemProps {
  index: number;
  children: JSX.Element;
  class?: string;
}

export function OnboardingStepAnimatedItem(
  props: OnboardingStepAnimatedItemProps,
) {
  return (
    <Animated
      class={props.class}
      style={{ "max-width": "100%" }}
      initial={{ opacity: 0, y: SLIDE_OFFSET_PX }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: NORMAL_DURATION_S,
        ease: "ease-in-out",
        delay: props.index * STAGGER_DELAY_S,
      }}
    >
      {props.children}
    </Animated>
  );
}

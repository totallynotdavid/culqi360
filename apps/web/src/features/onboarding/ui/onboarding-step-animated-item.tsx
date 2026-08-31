import { motion } from "@crm/solid-motion";
import { type JSX } from "@solidjs/web";

const SLIDE_OFFSET_PX = 12;
const STAGGER_DELAY_S = 0.07;
const NORMAL_DURATION_S = 0.3;

interface OnboardingStepAnimatedItemProps {
  index: number;
  children: JSX.Element;
  class?: string;
}

/** One line of an onboarding step, sliding up a beat after the line above it. */
export function OnboardingStepAnimatedItem(
  props: OnboardingStepAnimatedItemProps,
) {
  return (
    <motion.div
      class={props.class}
      style={{ "max-width": "100%" }}
      initial={{ opacity: 0, y: SLIDE_OFFSET_PX }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: NORMAL_DURATION_S,
        ease: "easeInOut",
        delay: props.index * STAGGER_DELAY_S,
      }}
    >
      {props.children}
    </motion.div>
  );
}

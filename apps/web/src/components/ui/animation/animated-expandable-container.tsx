import { motion } from "@crm/solid-motion";
import { type JSX } from "@solidjs/web";

interface AnimatedExpandableContainerProps {
  isExpanded: boolean;
  children: JSX.Element;
  duration?: number;
  opacityDuration?: number;
}

const EASE = [0.4, 0, 0.2, 1] as const;
const DEFAULT_DURATION_MS = 300;

const COLLAPSED = {
  height: 0,
  opacity: 0,
  overflow: "hidden",
  pointerEvents: "none",
} as const;

const EXPANDED = {
  height: "auto",
  opacity: 1,
  // Keep content clipped during the height animation.
  overflow: "hidden",
  pointerEvents: "auto",
} as const;

export function AnimatedExpandableContainer(
  props: AnimatedExpandableContainerProps,
) {
  const seconds = (ms: number | undefined) =>
    (ms ?? DEFAULT_DURATION_MS) / 1000;

  return (
    <motion.div
      initial={props.isExpanded ? EXPANDED : COLLAPSED}
      animate={
        props.isExpanded
          ? { ...EXPANDED, transitionEnd: { overflow: "visible" } }
          : COLLAPSED
      }
      transition={{
        duration: seconds(props.duration),
        ease: EASE,
        opacity: {
          duration: seconds(props.opacityDuration ?? props.duration),
          ease: EASE,
        },
      }}
    >
      {props.children}
    </motion.div>
  );
}

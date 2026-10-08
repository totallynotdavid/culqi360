import { type JSX } from "@solidjs/web";
import { motion } from "@totallynotdavid/solid-motion";

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
  // Hide overflow until the expansion transition completes.
  overflow: "hidden",
  pointerEvents: "auto",
} as const;

const seconds = (ms: number | undefined) => (ms ?? DEFAULT_DURATION_MS) / 1000;

export function AnimatedExpandableContainer(
  props: AnimatedExpandableContainerProps,
) {
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

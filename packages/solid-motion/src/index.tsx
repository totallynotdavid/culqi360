export { motion } from "./motion";
export { createMotion, type MotionHandle } from "./create-motion";
export {
  createAnimate,
  type AnimateFunction,
  type AnimateScope,
  type AnimateSegment,
  type AnimateSequence,
  type AnimateTarget,
} from "./create-animate";
export { createWillChange } from "./create-will-change";
export { createMotionValue, type MotionSource } from "./motion-values";
// The pure interpolator behind Motion's `useTransform` range form. In Solid a
// derived value is an accessor over it, not a second value to keep in sync.
export { transform } from "motion-dom";
// Builds the per-child delay function `delayChildren` takes: motion's own
// replacement for `staggerChildren`/`staggerDirection`, which stay supported
// as the plain-number convenience they always were.
export { stagger } from "motion-dom";
export {
  AnimatePresence,
  usePresence,
  type AnimatePresenceProps,
} from "./presence";
export {
  AnimatePresenceList,
  type AnimatePresenceListProps,
} from "./presence-list";
export { MotionConfig, useMotionConfig } from "./config";
export { useReducedMotion } from "./reduced-motion";
export { createInView } from "./gestures";
export type {
  AnimationDefinition,
  MotionComponent,
  MotionConfigState,
  MotionOptions,
  MotionStyle,
  MotionStyleValue,
  MotionValue,
  MotionProps,
  MotionProxy,
  TargetAndTransition,
  Transition,
  ViewportOptions,
  VariantDefinition,
  VariantMap,
  WillChange,
} from "./types";

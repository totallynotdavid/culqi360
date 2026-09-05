export { motion } from "./motion";
export { createMotion, type MotionHandle } from "./create-motion";
export { createMotionValue, type MotionSource } from "./motion-values";
// Motion's `useTransform` range interpolator, exposed as a Solid accessor.
export { transform } from "motion-dom";
// Builds per-child delays for variant orchestration.
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
export type { LayoutOption } from "./projection";
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
} from "./types";

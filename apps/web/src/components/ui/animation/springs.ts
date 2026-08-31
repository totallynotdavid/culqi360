import type { Transition } from "@crm/solid-motion";

/**
 * The spring the small controls move on: a toggle knob sliding, a radio dot
 * settling. One constant rather than two literals, because their feel is meant
 * to match and they inherited it from the same place.
 */
export const CONTROL_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 20,
} as const satisfies Transition;

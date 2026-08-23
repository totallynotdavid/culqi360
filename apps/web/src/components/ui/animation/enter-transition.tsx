import { motion } from "@crm/solid-motion";
import type { JSX } from "@solidjs/web";

const ENTER_TRANSITION = {
  duration: 0.28,
  ease: [0.16, 1, 0.3, 1],
} as const;

export function EnterTransition(props: { children: JSX.Element }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0, overflow: "hidden" }}
      animate={{
        opacity: 1,
        height: "auto",
        transitionEnd: { overflow: "visible" },
      }}
      transition={ENTER_TRANSITION}
    >
      {props.children}
    </motion.div>
  );
}

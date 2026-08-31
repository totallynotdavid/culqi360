import { AnimatePresence, motion } from "@crm/solid-motion";
import { type JSX } from "@solidjs/web";

interface PresenceTransitionProps {
  show: boolean;
  children: JSX.Element;
}

const FADE = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1],
} as const;

/**
 * Fades children in and out while keeping them mounted through the exit.
 */
export function PresenceTransition(props: PresenceTransitionProps) {
  return (
    <AnimatePresence when={props.show}>
      {() => (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE}
        >
          {props.children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

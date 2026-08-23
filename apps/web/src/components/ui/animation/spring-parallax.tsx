import { motion, useReducedMotion, type Transition } from "@crm/solid-motion";
import { type JSX } from "@solidjs/web";
import { createEffect, createSignal } from "solid-js";

interface SpringParallaxProps {
  children: JSX.Element;
  class?: string;
  style?: JSX.CSSProperties;
  range?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

/** Follows the pointer instantly; springs back to centre once it leaves. */
const TRACKING = { type: false } as const satisfies Transition;

/**
 * A few pixels of pointer parallax.
 *
 * `null` is the whole state machine: it means the pointer is gone, which is
 * both where the element returns to and which transition carries it there.
 * Tracking stays instant because the offset is already following a continuous
 * input; only the return home is a physical motion.
 */
export function SpringParallax(props: SpringParallaxProps) {
  const [pointer, setPointer] = createSignal<{ x: number; y: number } | null>(
    null,
  );
  const prefersReducedMotion = useReducedMotion();

  const offset = () => pointer() ?? { x: 0, y: 0 };
  const returnHome = (): Transition => ({
    type: "spring",
    stiffness: props.stiffness ?? 100,
    damping: props.damping ?? 10,
    mass: props.mass ?? 1,
  });

  // Not attached at all under reduced motion, rather than attached and
  // collapsed to zero duration: a parallax is nothing but movement, so the
  // honest reading of the preference is that it does not run.
  createEffect(
    () => prefersReducedMotion(),
    (reduced) => {
      // Reset here rather than from the cleanup: turning the preference on
      // mid-track has to bring the element home, and a cleanup also runs on
      // disposal, where writing a signal has no one left to read it.
      setPointer(null);
      if (reduced) return;

      const range = props.range ?? 2;
      const onPointerMove = (event: MouseEvent) => {
        setPointer({
          x: (event.clientX / window.innerWidth - 0.5) * 2 * range,
          y: (event.clientY / window.innerHeight - 0.5) * 2 * range,
        });
      };
      const onPointerLeave = () => setPointer(null);

      window.addEventListener("mousemove", onPointerMove);
      window.document.addEventListener("mouseleave", onPointerLeave);

      return () => {
        window.removeEventListener("mousemove", onPointerMove);
        window.document.removeEventListener("mouseleave", onPointerLeave);
      };
    },
  );

  return (
    <motion.div
      class={props.class}
      style={props.style}
      animate={{ x: offset().x, y: offset().y }}
      transition={pointer() ? TRACKING : returnHome()}
    >
      {props.children}
    </motion.div>
  );
}

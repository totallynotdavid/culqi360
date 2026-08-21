import { type JSX } from "@solidjs/web";
import { onSettled } from "solid-js";

import { prefersReducedMotion } from "./animate";

interface SpringParallaxProps {
  children: JSX.Element;
  class?: string;
  style?: JSX.CSSProperties;
  range?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

// Leave uses an underdamped spring so the element returns to center without a
// CSS easing curve:
// >>  x(t) = exp(-zeta * omega0 * t) * (A * sin(omegaD * t) + x0 * cos(omegaD * t))
export function SpringParallax(props: SpringParallaxProps) {
  let containerRef: HTMLDivElement | null = null;
  let rafId: number | undefined;

  onSettled(() => {
    // A rAF spring, not a WAAPI animation, so there is no duration to collapse:
    // under reduced motion the element simply stays put.
    if (typeof window === "undefined" || !containerRef) {
      return;
    }
    if (prefersReducedMotion()) {
      return;
    }

    const range = props.range ?? 2;
    const stiffness = props.stiffness ?? 100;
    const damping = props.damping ?? 10;
    const mass = props.mass ?? 1;
    const el = containerRef;

    const omega0 = Math.sqrt(stiffness / mass); // undamped angular freq (rad/s)
    const zeta = damping / (2 * Math.sqrt(stiffness * mass)); // damping ratio
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta); // damped angular freq

    let currentX = 0;
    let currentY = 0;

    const setTranslate = (x: number, y: number) => {
      currentX = x;
      currentY = y;
      el.style.transform = `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px)`;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      }
      const x = (e.clientX / window.innerWidth - 0.5) * 2 * range;
      const y = (e.clientY / window.innerHeight - 0.5) * 2 * range;
      setTranslate(x, y);
    };

    const onMouseLeave = () => {
      const x0 = currentX;
      const y0 = currentY;
      // Initial velocity is 0; tracking was instantaneous (direct set).
      const Ax = (zeta * omega0 * x0) / omegaD;
      const Ay = (zeta * omega0 * y0) / omegaD;
      const startMs = performance.now();

      const animate = (now: DOMHighResTimeStamp) => {
        const t = (now - startMs) / 1000;
        const envelope = Math.exp(-zeta * omega0 * t);
        const sin = Math.sin(omegaD * t);
        const cos = Math.cos(omegaD * t);

        const x = envelope * (Ax * sin + x0 * cos);
        const y = envelope * (Ay * sin + y0 * cos);
        setTranslate(x, y);

        if (envelope < 0.001) {
          setTranslate(0, 0);
          return;
        }
        rafId = requestAnimationFrame(animate);
      };

      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.document.addEventListener("mouseleave", onMouseLeave);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.document.removeEventListener("mouseleave", onMouseLeave);
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
    };
  });

  return (
    <div
      ref={(el) => (containerRef = el)}
      class={props.class}
      style={props.style}
    >
      {props.children}
    </div>
  );
}

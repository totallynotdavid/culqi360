import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { type JSX } from "@solidjs/web";

const DURATION_MS = 300;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface PresenceTransitionProps {
  show: boolean;
  children: JSX.Element;
}

export function PresenceTransition(props: PresenceTransitionProps) {
  const [mounted, setMounted] = createSignal(props.show);
  let el: HTMLDivElement | undefined;
  let anim: Animation | undefined;

  createEffect(() => {
    const show = props.show;

    if (show) {
      setMounted(true);

      if (prefersReducedMotion()) {
        return;
      }

      // rAF ensures paint before animating (the el ref is set on mount).
      requestAnimationFrame(() => {
        if (!el) {
          return;
        }
        anim?.cancel();
        el.style.opacity = "0";
        anim = el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: DURATION_MS,
          easing: "ease",
        });
        anim.onfinish = () => {
          if (el) {
            el.style.opacity = "";
          }
        };
      });
    } else {
      if (prefersReducedMotion() || !el) {
        setMounted(false);
        return;
      }

      anim?.cancel();
      anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: DURATION_MS,
        easing: "ease",
      });
      anim.onfinish = () => setMounted(false);
    }
  });

  onCleanup(() => anim?.cancel());

  return (
    <Show when={mounted()}>
      <div ref={(r) => (el = r)}>{props.children}</div>
    </Show>
  );
}

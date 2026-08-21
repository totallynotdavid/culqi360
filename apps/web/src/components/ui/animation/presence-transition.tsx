import { type JSX } from "@solidjs/web";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

import { animate } from "./animate";

const DURATION_MS = 300;

interface PresenceTransitionProps {
  show: boolean;
  children: JSX.Element;
}

export function PresenceTransition(props: PresenceTransitionProps) {
  const [mounted, setMounted] = createSignal(props.show);
  let el: HTMLDivElement | undefined;
  let anim: Animation | undefined;

  createEffect(
    () => props.show,
    (show) => {
      if (show) {
        setMounted(true);

        // rAF ensures paint before animating (the el ref is set on mount).
        requestAnimationFrame(() => {
          if (!el) {
            return;
          }
          anim?.cancel();
          el.style.opacity = "0";
          anim = animate(el, [{ opacity: 0 }, { opacity: 1 }], {
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
        if (!el) {
          setMounted(false);
          return;
        }

        anim?.cancel();
        anim = animate(el, [{ opacity: 1 }, { opacity: 0 }], {
          duration: DURATION_MS,
          easing: "ease",
        });
        anim.onfinish = () => setMounted(false);
      }
    },
  );

  onCleanup(() => anim?.cancel());

  return (
    <Show when={mounted()}>
      <div ref={(r) => (el = r)}>{props.children}</div>
    </Show>
  );
}

import { createSignal, onSettled, type Accessor } from "solid-js";

const [prefersReducedMotion, setPrefersReducedMotion] = createSignal(false);
let mediaQuery: MediaQueryList | undefined;
let listenerInstalled = false;

function installListener() {
  if (listenerInstalled || typeof window === "undefined") return;

  listenerInstalled = true;
  mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (!mediaQuery) return;

  const update = () => setPrefersReducedMotion(mediaQuery?.matches ?? false);
  update();
  mediaQuery.addEventListener("change", update);
}

/** Returns a reactive snapshot of the device's reduced-motion preference. */
export function useReducedMotion(): Accessor<boolean> {
  onSettled(installListener);
  return prefersReducedMotion;
}

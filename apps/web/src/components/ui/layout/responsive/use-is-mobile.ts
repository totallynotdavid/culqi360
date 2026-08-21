import { createSignal, onSettled } from "solid-js";

import { MOBILE_VIEWPORT } from "~/components/ui/theme/design-system";

// Use this for structural switches that need a different DOM tree. Cosmetic
// responsive changes belong in CSS so SSR can render the right layout.
export function useIsMobile() {
  const [isMobile, setIsMobile] = createSignal(false);

  onSettled(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_VIEWPORT}px)`);
    setIsMobile(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  });

  return isMobile;
}

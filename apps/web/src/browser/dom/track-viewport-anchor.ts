import { createEffect, type Accessor } from "solid-js";

/**
 * Keeps a floating element pinned to its trigger while it is open.
 *
 * A popover positioned from `getBoundingClientRect()` goes stale the moment the
 * page scrolls or the window resizes, so `reposition` runs once on open and
 * again on every viewport change until it closes. Scroll is captured, because
 * the trigger usually moves with an inner scroller that never bubbles.
 *
 * Listeners exist only while open: an always-on scroll handler on a closed menu
 * is the version of this that shows up in a profile.
 */
export function trackViewportAnchor(
  open: Accessor<boolean>,
  reposition: () => void,
): void {
  // The effect phase's return value is its cleanup, so closing removes the
  // listeners that opening added.
  createEffect(open, (isOpen) => {
    if (!isOpen) {
      return;
    }

    reposition();

    const handleViewportChange = () => reposition();

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  });
}

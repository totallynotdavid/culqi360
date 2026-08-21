/**
 * Whether the viewer asked for reduced motion.
 *
 * Read when an animation starts rather than tracked as a signal: an animation
 * already in flight should finish the way it began, and every caller here is
 * deciding at exactly that moment.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * `element.animate()` with the motion preference already applied.
 *
 * Under reduced motion this collapses the duration to zero rather than skipping
 * the call. That matters: the animation still resolves, `onfinish` still fires,
 * and `cancel()` still works, so the settle logic that follows an animation
 * needs no second path. Every caller that used to guard itself was really
 * writing that second path by hand, and one of them forgot to.
 */
export function animate(
  element: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation {
  return element.animate(
    keyframes,
    prefersReducedMotion() ? { ...options, duration: 0, delay: 0 } : options,
  );
}

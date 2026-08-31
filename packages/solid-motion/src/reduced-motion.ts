import { createSignal, type Accessor } from "solid-js";

/**
 * One listener per document, installed at module load rather than per element.
 *
 * The earlier version registered an `onSettled` in every motion component, so a
 * hundred animated rows scheduled a hundred callbacks to install a listener
 * that is idempotent and, under the default `reducedMotion: "never"`, never
 * read. A module-scope signal is a global in Solid 2, which is what this is.
 *
 * The write happens from a media-query event, never during render, so no owned
 * scope is written to. On the server the query is absent and the value stays
 * `false`; that cannot desync hydration because the preference only selects a
 * transition, never an initial style.
 */
const query =
  typeof window === "undefined"
    ? undefined
    : window.matchMedia?.("(prefers-reduced-motion: reduce)");

const [prefersReducedMotion, setPrefersReducedMotion] = createSignal(
  query?.matches ?? false,
);

query?.addEventListener("change", (event) =>
  setPrefersReducedMotion(event.matches),
);

/** The device's reduced-motion preference, as a reactive accessor. */
export function useReducedMotion(): Accessor<boolean> {
  return prefersReducedMotion;
}

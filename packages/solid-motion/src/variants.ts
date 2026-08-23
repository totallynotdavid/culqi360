import { createContext, untrack, useContext } from "solid-js";

import { gestureNames, type GestureName } from "./gestures";
import type { AnimationDefinition, Transition } from "./types";

/** Every prop a variant label can be attached to, in Motion's own vocabulary. */
export type VariantLayer = "initial" | "animate" | "exit" | GestureName;

export interface Orchestration {
  delayChildren: number;
  staggerChildren: number;
  staggerDirection: number;
}

/**
 * What a variant-controlling element offers its descendants.
 *
 * Propagation itself needs no machinery here: a child reads the label from
 * context and resolves it against its own `variants` map, so the cascade is the
 * context. Motion has to walk a `variantChildren` set and recursively call
 * `animateVariant` on each one, because React gives it no way to let a child
 * observe an ancestor's animation state.
 *
 * What does need machinery is stagger, which depends on a child's position
 * among its siblings, and that is what `register` and `delayFor` are for.
 */
export interface VariantScope {
  label: (layer: VariantLayer) => AnimationDefinition | undefined;
  custom: () => unknown;
  register: (element: Element) => () => void;
  delayFor: (element: Element) => number;
}

export const VariantContext = createContext<VariantScope | null>(null);

export function useVariants(): VariantScope | null {
  return useContext(VariantContext);
}

/**
 * A label is a name pointing into a `variants` map. Anything else is a target
 * object and is not inheritable, because it means nothing to a child with a
 * different `variants` map.
 */
function isVariantLabel(
  definition: AnimationDefinition | true | undefined,
): definition is string | string[] {
  return (
    typeof definition === "string" ||
    (Array.isArray(definition) &&
      definition.every((v) => typeof v === "string"))
  );
}

function readOrchestration(transition: Transition | undefined): Orchestration {
  const options = transition as
    | (Transition & Partial<Orchestration>)
    | undefined;

  return {
    delayChildren: options?.delayChildren ?? 0,
    staggerChildren: options?.staggerChildren ?? 0,
    staggerDirection: options?.staggerDirection ?? 1,
  };
}

/**
 * Tracks the children of one variant-controlling element and turns a child into
 * a stagger delay.
 *
 * Registration order is not sibling order: a keyed list can reorder its rows
 * without any of them re-registering, and a child added later belongs wherever
 * it sits in the document. So position is read from the DOM at the moment the
 * delay is needed rather than trusted from when the child appeared.
 */
function createChildRegistry(orchestration: () => Orchestration) {
  const children = new Set<Element>();

  return {
    register(element: Element) {
      children.add(element);
      return () => {
        children.delete(element);
      };
    },

    delayFor(element: Element): number {
      const { delayChildren, staggerChildren, staggerDirection } =
        orchestration();

      if (staggerChildren === 0) return delayChildren;

      const ordered = [...children].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
      const index = ordered.indexOf(element);
      if (index === -1) return delayChildren;

      const span = (ordered.length - 1) * staggerChildren;
      const offset =
        staggerDirection === 1
          ? index * staggerChildren
          : span - index * staggerChildren;

      return delayChildren + offset;
    },
  };
}

/** Every prop that can carry a variant label, in Motion's own vocabulary. */
const variantLayers: readonly VariantLayer[] = [
  "initial",
  "animate",
  "exit",
  ...gestureNames,
];

/**
 * The scope an element offers its descendants, or `null` when it has no labels
 * to offer.
 *
 * A fresh scope rather than an extension of the ancestor's: Motion builds the
 * context from a controlling node's own label-valued props, so a parent naming
 * `animate` but not `whileHover` does not leak a grandparent's `whileHover`
 * down. Whether an element controls variants is read once, the way Motion
 * decides it at element creation.
 */
export function createVariantScope(
  options: () => Partial<Record<VariantLayer, AnimationDefinition>>,
  custom: () => unknown,
  transition: () => Transition | undefined,
): VariantScope | null {
  const controls = untrack(() =>
    variantLayers.some((layer) => isVariantLabel(options()[layer])),
  );
  if (!controls) return null;

  const registry = createChildRegistry(() => readOrchestration(transition()));

  return {
    label: (layer) => {
      const own = options()[layer];
      return isVariantLabel(own) ? own : undefined;
    },
    custom,
    register: registry.register,
    delayFor: registry.delayFor,
  };
}

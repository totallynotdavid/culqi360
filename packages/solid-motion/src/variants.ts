import type { DynamicOption } from "motion-dom";
import { createContext, untrack, useContext } from "solid-js";

import { gestureNames, type GestureName } from "./gestures";
import type { AnimationDefinition, Transition } from "./types";

/** Every prop a variant label can be attached to, in Motion's own vocabulary. */
export type VariantLayer = "initial" | "animate" | "exit" | GestureName;

export interface Orchestration {
  /**
   * A per-child function supersedes `staggerChildren`/`staggerDirection`
   * entirely, matching motion: `stagger()` (or a caller's own function) already
   * decides every child's offset, so the constant forms have nothing left to
   * add. A plain number is the base every child's offset is added to.
   */
  delayChildren: number | DynamicOption<number>;
  staggerChildren: number;
  staggerDirection: number;
  /** Which side of the family animates first, or `false` for all at once. */
  when: "beforeChildren" | "afterChildren" | false;
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
  /** Whose pass waits for whose, when the variant asks for an order. */
  sequencer: Sequencer;
}

/**
 * One pass's place in the queue. `wait` is handed what would have started it and
 * calls that when its turn comes; `done` reports the pass over, whether it
 * finished or lost to a later one.
 */
export interface PassTurn {
  wait: (begin: VoidFunction) => void;
  done: () => void;
}

export interface Sequencer {
  /** A turn for a descendant's pass, or `undefined` when nothing orders them. */
  child: () => PassTurn | undefined;
  /** A turn for this element's own pass, on the same terms. */
  self: () => PassTurn | undefined;
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

/**
 * `Transition` already declares every one of these fields; it is motion-dom's
 * own type, re-exported wholesale. The cast this used to reach through was
 * pure narrowing theatre, and a dangerous one: it told the compiler
 * `delayChildren` was always a `number` when the field it was reading is
 * typed `number | DynamicOption<number>` upstream, so a caller passing
 * `stagger()` (motion's own recommended replacement for `staggerChildren`,
 * not a foreign shape) type-checked and then hit `functionValue + offset` in
 * `delayFor`, coercing the function to its source text as a string. No
 * warning, no error, a garbled delay.
 *
 * `when` keeps its own narrowing, because motion's type also allows an
 * arbitrary string there for hooking into custom orchestration signals this
 * package does not implement; anything other than the two literals falls back
 * to `false` rather than being trusted through.
 */
function readOrchestration(transition: Transition | undefined): Orchestration {
  return {
    delayChildren: transition?.delayChildren ?? 0,
    staggerChildren: transition?.staggerChildren ?? 0,
    staggerDirection: transition?.staggerDirection ?? 1,
    when:
      transition?.when === "beforeChildren" ||
      transition?.when === "afterChildren"
        ? transition.when
        : false,
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

      // Sibling position is the one input a stagger function needs that a
      // constant delay does not, so it is resolved once here regardless of
      // which form `delayChildren` takes.
      const ordered = [...children].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
      const index = ordered.indexOf(element);

      if (typeof delayChildren === "function") {
        // The base delay is not added in this branch, matching motion: the
        // function already describes every child's full offset, including
        // whichever one of them should go first.
        return index === -1 ? 0 : delayChildren(index, ordered.length);
      }

      if (staggerChildren === 0 || index === -1) return delayChildren;

      const span = (ordered.length - 1) * staggerChildren;
      const offset =
        staggerDirection === 1
          ? index * staggerChildren
          : span - index * staggerChildren;

      return delayChildren + offset;
    },
  };
}

/**
 * Orders a variant-controlling element's own pass against its descendants'.
 *
 * `when` is the one orchestration option that is not expressible as a delay,
 * because a spring has no duration to offset by. Motion sequences promises
 * instead, which it can do because it starts its children's animations itself:
 * `animateVariant` walks a `variantChildren` set. Nothing here starts anyone
 * else's animation, so both sides announce themselves to this object and it
 * decides who waits.
 *
 * Both sides read the same `when`, the controlling element's, so an element
 * with no order to impose hands out no turns at all and its descendants never
 * allocate one. That matters: `when` is rare and a staggered list is not.
 *
 * Within a scope that does use it, announcing is unconditional even for the
 * direction that is not waiting. A child under `afterChildren` does not wait,
 * but it does have to be counted, or the parent it is holding up would see an
 * empty room.
 */
function createSequencer(orchestration: () => Orchestration) {
  let selfRunning = false;
  let childrenRunning = 0;
  const waitingChildren: VoidFunction[] = [];
  const waitingSelf: VoidFunction[] = [];

  const release = (waiting: VoidFunction[]) => {
    for (const begin of waiting.splice(0)) begin();
  };

  const turn = (
    hold: (queued: VoidFunction) => boolean,
    enter: VoidFunction,
    leave: VoidFunction,
  ): PassTurn => {
    let started = false;

    return {
      wait(begin) {
        // What gets queued is the whole of starting, not just `begin`: a pass
        // released later has to count itself in exactly as one released now.
        const run = () => {
          started = true;
          enter();
          begin();
        };

        if (hold(run)) return;
        run();
      },
      done() {
        if (!started) return;
        started = false;
        leave();
      },
    };
  };

  return {
    child: () => {
      if (orchestration().when === false) return undefined;

      return turn(
        (queued) => {
          if (!selfRunning || orchestration().when !== "beforeChildren") {
            return false;
          }
          waitingChildren.push(queued);
          return true;
        },
        () => (childrenRunning += 1),
        () => {
          childrenRunning -= 1;
          if (childrenRunning === 0) release(waitingSelf);
        },
      );
    },

    self: () => {
      if (orchestration().when === false) return undefined;

      return turn(
        (queued) => {
          if (orchestration().when !== "afterChildren") return false;

          // Children run their own effects after this one, so the count is not
          // final until the next microtask. That is the same reading the
          // presence boundary takes when it decides an item has no exit to
          // play, and for the same reason.
          queueMicrotask(() => {
            if (childrenRunning > 0) {
              waitingSelf.push(queued);
              return;
            }
            queued();
          });
          return true;
        },
        () => (selfRunning = true),
        () => {
          selfRunning = false;
          release(waitingChildren);
        },
      );
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

  const orchestration = () => readOrchestration(transition());
  const registry = createChildRegistry(orchestration);

  return {
    label: (layer) => {
      const own = options()[layer];
      return isVariantLabel(own) ? own : undefined;
    },
    custom,
    register: registry.register,
    delayFor: registry.delayFor,
    sequencer: createSequencer(orchestration),
  };
}

/**
 * The turns one pass has to take before it may start, and the reporter that
 * frees whoever is waiting on it. `undefined` when this element is neither
 * inside a variant scope nor offering one, which is the common case.
 */
export interface PassSequence {
  begin: (start: VoidFunction) => void;
  settled: () => void;
}

export function sequencePass(
  inherited: VariantScope | null,
  own: VariantScope | null,
): PassSequence | undefined {
  // As a child first: an element inside a `beforeChildren` parent has to be let
  // through before its own children can be made to wait on it.
  const turns = [inherited?.sequencer.child(), own?.sequencer.self()].filter(
    (pending): pending is PassTurn => pending !== undefined,
  );
  if (turns.length === 0) return undefined;

  return {
    begin: (start) =>
      turns.reduceRight<VoidFunction>(
        (next, pending) => () => pending.wait(next),
        start,
      )(),
    settled: () => {
      for (const pending of turns) pending.done();
    },
  };
}

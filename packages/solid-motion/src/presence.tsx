import {
  createContext,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  runWithOwner,
  untrack,
  useContext,
  type Accessor,
  type Element,
} from "solid-js";

import type { PresenceScope } from "./types";

const PresenceContext = createContext<PresenceScope | null>(null);

/**
 * The presence boundary this element sits in, or `null` when it sits outside
 * one. Outside a boundary an element is always present and nothing waits on it.
 */
export function usePresence(): PresenceScope | null {
  return useContext(PresenceContext);
}

interface PresenceChildProps {
  children: Element;
  isPresent: boolean;
  initial?: boolean;
  custom?: unknown;
  onExitComplete: () => void;
}

/**
 * Owns one item's exit. Elements underneath announce that they are animating
 * out by taking a hold; the item leaves when the last one is released.
 *
 * A hold is not a promise. A cancelled motion animation's `finished` never
 * resolves and never rejects, so a protocol built on promises hangs the moment
 * an exit is interrupted. Releasing is something the element does on every
 * terminal path, including the one where it lost.
 */
export function PresenceChild(props: PresenceChildProps) {
  let holds = 0;

  const leaveIfDone = () => {
    if (holds !== 0) return;
    // The item can come back inside the same flush that its exit started in.
    if (props.isPresent) return;
    props.onExitComplete();
  };

  const scope: PresenceScope = {
    isPresent: () => props.isPresent,
    initial: () => props.initial,
    custom: () => props.custom,
    hold: () => {
      holds += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holds -= 1;
        leaveIfDone();
      };
    },
  };

  createEffect(
    () => props.isPresent,
    (isPresent) => {
      if (isPresent) return;
      // Anything with an exit to play takes its hold in this same flush, so by
      // the next microtask the count is final. Still zero means nothing under
      // this item had an exit at all, and it can leave now.
      queueMicrotask(leaveIfDone);
    },
  );

  return <PresenceContext value={scope}>{props.children}</PresenceContext>;
}

/** One subtree the boundary is keeping on screen, entering or on its way out. */
interface Rendering {
  /** The `when` value it was built for; identity decides whether it survives. */
  key: unknown;
  nodes: Element;
  present: Accessor<boolean>;
  setPresent: (present: boolean) => void;
  dispose: VoidFunction;
}

export interface AnimatePresenceProps<T> {
  /**
   * What is on screen, and its identity in one value. Falsy renders nothing;
   * changing it to a different truthy value swaps, with the outgoing subtree
   * animating out while the incoming one animates in.
   */
  when: T;
  children: (value: NonNullable<T>) => Element;
  /** `false` skips the entrance on first render, for a subtree already on screen. */
  initial?: boolean;
  custom?: unknown;
  /** `wait` holds the newcomer back until the outgoing subtree is gone. */
  mode?: "sync" | "wait";
  onExitComplete?: () => void;
}

/**
 * Keeps a subtree mounted while it animates out.
 *
 * `when` rather than a conditional child, because Solid disposes a branch the
 * moment its condition flips: by the time a boundary could notice the child had
 * gone, the motion element's cleanup has already run and there is nothing left
 * to animate. React can hold a removed child because it re-renders and diffs;
 * Solid gives no such window. So the boundary builds the subtree itself, in a
 * root parented to this component, and decides when that root is torn down.
 *
 * That is also why `when` doubles as the key. It is the one value the caller
 * already has, and Motion's own `key` prop on the child says the same thing.
 */
export function AnimatePresence<T>(props: AnimatePresenceProps<T>): Element {
  const owner = getOwner();

  const remove = (rendering: Rendering) => {
    // Dropped from the list first: Solid takes the nodes out of the document,
    // and only then is it safe to tear down the reactivity behind them.
    setRenderings((current) => current.filter((entry) => entry !== rendering));
    rendering.dispose();

    // Snapshot reads, not subscriptions. Solid 2 warns about a bare read here
    // for good reason, and `untrack` is how you say the snapshot is the point.
    const stillLeaving = untrack(() =>
      renderings().some((entry) => !entry.present()),
    );
    if (!stillLeaving) props.onExitComplete?.();
  };

  const build = (key: NonNullable<T>): Rendering =>
    runWithOwner(owner, () =>
      createRoot((dispose) => {
        const [present, setPresent] = createSignal(true);
        // Assigned below and read only from the callback, which cannot fire
        // before the subtree it belongs to exists.
        let rendering: Rendering;

        const nodes = (
          <PresenceChild
            isPresent={present()}
            initial={props.initial}
            custom={props.custom}
            onExitComplete={() => remove(rendering)}
          >
            {props.children(key)}
          </PresenceChild>
        );

        rendering = { key, nodes, present, setPresent, dispose };
        return rendering;
      }),
    ) as Rendering;

  // Built during render rather than from the effect below, so the server emits
  // the subtree and the first client paint carries it. An effect would leave
  // both empty. It seeds the signal instead of writing to it, because Solid 2
  // rejects a write from inside a component body.
  const [renderings, setRenderings] = createSignal<Rendering[]>(
    untrack(() => (props.when ? [build(props.when as NonNullable<T>)] : [])),
  );

  createEffect(
    () => props.when,
    (when) => {
      const current = untrack(renderings);
      const newest = current.at(-1);
      if (newest && newest.key === when && untrack(newest.present)) return;

      for (const rendering of current) rendering.setPresent(false);

      if (!when) return;

      // Coming back to a key that is still animating out revives that subtree
      // instead of building a second one beside it.
      const returning = current.find((entry) => entry.key === when);
      if (returning) {
        returning.setPresent(true);
        return;
      }

      setRenderings([...current, build(when as NonNullable<T>)]);
    },
  );

  const rendered = createMemo(() => {
    const all = renderings();
    if (props.mode !== "wait") return all;
    const leaving = all.filter((entry) => !entry.present());
    return leaving.length > 0 ? leaving : all;
  });

  return <>{rendered().map((entry) => entry.nodes)}</>;
}

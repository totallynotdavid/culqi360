import { For, type JSX } from "@solidjs/web";
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
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
function PresenceChild(props: PresenceChildProps) {
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

/** One item the boundary is keeping on screen, present or on its way out. */
interface PresenceEntry<T> {
  key: string;
  item: T;
  present: boolean;
}

export interface AnimatePresenceProps<T> {
  each: readonly T[];
  getKey: (item: T) => string;
  children: (item: Accessor<T>) => JSX.Element;
  initial?: boolean;
  custom?: unknown;
  mode?: "sync" | "wait";
  onExitComplete?: () => void;
}

export function AnimatePresence<T>(props: AnimatePresenceProps<T>) {
  const toEntry = (item: T): PresenceEntry<T> => ({
    key: props.getKey(item),
    item,
    present: true,
  });

  /**
   * One list, not several. Everything the boundary needs is a view of it: what
   * is on screen is the list, what is leaving is the entries with `present`
   * false, and an item's latest data is its `item`.
   *
   * The earlier version kept a present list, a rendered list, a key index, an
   * exiting set and a signal per item, which is the shape React forces because
   * it cannot hand a surviving child new data without re-rendering it. Solid's
   * keyed `<For>` gives each row an accessor that follows entry replacement
   * without recreating the row, so a single signal covers all of it.
   */
  const [entries, setEntries] = createSignal<PresenceEntry<T>[]>(
    untrack(() => props.each.map(toEntry)),
  );

  createEffect(
    () => props.each,
    (items) => {
      setEntries((current) => diffEntries(current, items, props.getKey));
    },
  );

  // `wait` holds the newcomers back entirely until the outgoing ones are gone.
  const rendered = createMemo(() => {
    const all = entries();
    if (props.mode !== "wait") return all;
    const leaving = all.filter((entry) => !entry.present);
    return leaving.length > 0 ? leaving : all;
  });

  const completeExit = (key: string) => {
    setEntries((current) => {
      // The item can have come back while its exit was still playing.
      const leaving = current.find((entry) => entry.key === key);
      if (!leaving || leaving.present) return current;
      return current.filter((entry) => entry.key !== key);
    });

    if (!entries().some((entry) => !entry.present)) props.onExitComplete?.();
  };

  return (
    <For each={rendered()} keyed={(entry) => entry.key}>
      {(entry) => (
        <PresenceChild
          isPresent={entry().present}
          initial={props.initial}
          custom={props.custom}
          onExitComplete={() => completeExit(entry().key)}
        >
          {props.children(() => entry().item)}
        </PresenceChild>
      )}
    </For>
  );
}

/**
 * Rebuilds the list from the incoming collection, keeping anything that left it
 * at the index it used to hold so a row does not jump while it animates out.
 */
function diffEntries<T>(
  current: readonly PresenceEntry<T>[],
  items: readonly T[],
  getKey: (item: T) => string,
): PresenceEntry<T>[] {
  const previous = new Map(current.map((entry) => [entry.key, entry]));
  const seen = new Set<string>();
  const next: PresenceEntry<T>[] = [];

  for (const item of items) {
    const key = getKey(item);

    // Reported, never thrown. An uncaught error inside an effect halts Solid's
    // reactive system for the whole application, so throwing here would turn a
    // mis-keyed list into a dead page. Keeping the first occurrence at least
    // leaves the diff coherent.
    if (seen.has(key)) {
      console.error(
        `AnimatePresence: getKey returned "${key}" for more than one item. ` +
          "Presence diffing cannot tell those items apart, so the extra ones " +
          "are ignored.",
      );
      continue;
    }
    seen.add(key);

    const entry = previous.get(key);
    next.push(
      entry && entry.present && entry.item === item
        ? entry
        : { key, item, present: true },
    );
  }

  current.forEach((entry, index) => {
    if (seen.has(entry.key)) return;
    next.splice(index, 0, entry.present ? { ...entry, present: false } : entry);
  });

  return next;
}

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

interface TrackedChild<T> {
  key: string;
  item: Accessor<T>;
  setItem: (item: T) => void;
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
  const makeChildren = (items: readonly T[]): TrackedChild<T>[] =>
    items.map((item): TrackedChild<T> => {
      const [current, setCurrent] = createSignal<unknown>(item);
      return {
        key: props.getKey(item),
        item: current as Accessor<T>,
        setItem: (next: T): void => {
          setCurrent(() => next);
        },
      };
    });

  const initialChildren = untrack(() => makeChildren(props.each));
  const [presentChildren, setPresentChildren] =
    createSignal<TrackedChild<T>[]>(initialChildren);
  const [renderedChildren, setRenderedChildren] =
    createSignal<TrackedChild<T>[]>(initialChildren);
  const trackedByKey = new Map(
    initialChildren.map((child) => [child.key, child]),
  );
  const exitingKeys = new Set<string>();
  let didMount = false;

  const presentKeys = createMemo(
    () => new Set(presentChildren().map((child) => child.key)),
  );

  createEffect(
    () => props.each,
    (items) => {
      const next = items.map((item) => {
        const key = props.getKey(item);
        const existing = trackedByKey.get(key);
        if (existing) {
          existing.setItem(item);
          return existing;
        }
        const child = makeChildren([item])[0];
        trackedByKey.set(key, child);
        return child;
      });
      const nextKeys = new Set(next.map((child) => child.key));
      setPresentChildren(next);

      if (!didMount) {
        didMount = true;
        setRenderedChildren(next);
        return;
      }

      setRenderedChildren((current) => {
        const enteringAndPresent = [...next];
        const exiting: TrackedChild<T>[] = [];
        current.forEach((child, index) => {
          if (!nextKeys.has(child.key)) {
            exitingKeys.add(child.key);
            enteringAndPresent.splice(index, 0, child);
            exiting.push(child);
          } else {
            exitingKeys.delete(child.key);
          }
        });
        return props.mode === "wait" && exiting.length > 0
          ? exiting
          : enteringAndPresent;
      });
    },
  );

  const completeExit = (key: string) => {
    if (!exitingKeys.delete(key)) return;
    trackedByKey.delete(key);
    setRenderedChildren((current) => {
      const present = presentChildren();
      const withoutExit = current.filter((child) => child.key !== key);
      return exitingKeys.size === 0 && props.mode === "wait"
        ? present
        : withoutExit;
    });
    if (exitingKeys.size === 0) props.onExitComplete?.();
  };

  return (
    <For each={renderedChildren()} keyed={(child) => child.key}>
      {(child) => (
        <PresenceChild
          isPresent={presentKeys().has(child().key)}
          initial={props.initial}
          custom={props.custom}
          onExitComplete={() => completeExit(child().key)}
        >
          {props.children(child().item)}
        </PresenceChild>
      )}
    </For>
  );
}

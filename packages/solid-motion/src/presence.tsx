import { For, type JSX } from "@solidjs/web";
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  onSettled,
  untrack,
  type Accessor,
  type Element,
  useContext,
} from "solid-js";

import type { PresenceContextValue } from "./types";

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function usePresence(
  subscribe = true,
): [Accessor<boolean>, (() => void) | null] {
  const context = useContext(PresenceContext);
  if (!context) return [() => true, null];

  const isPresent = createMemo(() => context.isPresent());

  const id = createUniqueId();

  onSettled(() => {
    if (!subscribe) return;
    return context.register(id);
  });

  const safeToRemove = () => {
    if (subscribe) context.onExitComplete?.(id);
  };

  return [isPresent, subscribe ? safeToRemove : null];
}

export function usePresenceContext() {
  return useContext(PresenceContext);
}

interface PresenceChildProps {
  children: Element;
  isPresent: boolean;
  initial?: boolean;
  custom?: unknown;
  onExitComplete?: () => void;
}

function PresenceChild(props: PresenceChildProps) {
  const id = createUniqueId();
  const childrenState = new Map<string, boolean>();
  const context: PresenceContextValue = {
    id,
    isPresent: () => props.isPresent,
    initial: () => props.initial,
    custom: () => props.custom,
    register: (childId) => {
      childrenState.set(childId, false);
      return () => childrenState.delete(childId);
    },
    onExitComplete: (childId) => {
      childrenState.set(childId, true);
      if ([...childrenState.values()].every(Boolean)) props.onExitComplete?.();
    },
  };

  createEffect(
    () => props.isPresent,
    (isPresent) => {
      if (!isPresent && childrenState.size === 0) props.onExitComplete?.();
      if (isPresent)
        childrenState.forEach((_, childId) =>
          childrenState.set(childId, false),
        );
    },
  );

  onCleanup(() => childrenState.clear());

  return <PresenceContext value={context}>{props.children}</PresenceContext>;
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
    <>
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
    </>
  );
}

export { PresenceContext };

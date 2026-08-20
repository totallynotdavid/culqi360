import { type JSX } from "@solidjs/web";
import { createEffect, createMemo, createSignal, For } from "solid-js";

import { PresenceChild } from "./presence-child";

export interface AnimatePresenceProps<T> {
  each: readonly T[];
  getKey: (item: T) => string;
  children: (item: T) => JSX.Element;
  initial?: boolean;
  custom?: any;
  onExitComplete?: () => void;
  mode?: "sync" | "wait";
}

interface TrackedChild<T> {
  item: T;
  key: string;
}

export function AnimatePresence<T>(props: AnimatePresenceProps<T>) {
  const [renderedChildren, setRenderedChildren] = createSignal<
    TrackedChild<T>[]
  >([]);
  const [presentChildren, setPresentChildren] = createSignal<TrackedChild<T>[]>(
    [],
  );
  const exitingKeys = new Set<string>();
  const trackedByKey = new Map<string, TrackedChild<T>>();
  let didMount = false;
  const presentKeySet = createMemo(
    () => new Set(presentChildren().map((child) => child.key)),
  );

  createEffect(
    () => props.each,
    (each) => {
      const nextPresentChildren = each.map((item) => {
        const key = props.getKey(item);
        const existing = trackedByKey.get(key);
        if (existing) {
          existing.item = item;
          return existing;
        }
        const trackedChild = { item, key };
        trackedByKey.set(key, trackedChild);
        return trackedChild;
      });
      const nextPresentKeys = new Set(
        nextPresentChildren.map((child) => child.key),
      );
      setPresentChildren(nextPresentChildren);

      if (!didMount) {
        didMount = true;
        setRenderedChildren(nextPresentChildren);
        return;
      }

      setRenderedChildren((currentRenderedChildren) => {
        const nextChildren = [...nextPresentChildren];
        const exitingChildren: TrackedChild<T>[] = [];

        currentRenderedChildren.forEach((child, index) => {
          if (!nextPresentKeys.has(child.key)) {
            exitingKeys.add(child.key);
            nextChildren.splice(index, 0, child);
            exitingChildren.push(child);
          } else {
            exitingKeys.delete(child.key);
          }
        });

        if ((props.mode ?? "sync") === "wait" && exitingChildren.length > 0) {
          return exitingChildren;
        }

        return nextChildren;
      });
    },
  );

  const handleChildExitComplete = (key: string) => {
    if (!exitingKeys.has(key)) {
      return;
    }
    exitingKeys.delete(key);

    setRenderedChildren((current) =>
      current.filter((child) => child.key !== key),
    );
    trackedByKey.delete(key);

    if (exitingKeys.size === 0) {
      props.onExitComplete?.();
    }
  };

  return (
    <>
      <For each={renderedChildren()}>
        {(child) => {
          return (
            <PresenceChild
              key={child.key}
              isPresent={presentKeySet().has(child.key)}
              initial={props.initial === false ? false : undefined}
              custom={props.custom}
              presenceAffectsLayout
              mode="sync"
              onExitComplete={() => handleChildExitComplete(child.key)}
            >
              {props.children(child.item)}
            </PresenceChild>
          );
        }}
      </For>
    </>
  );
}

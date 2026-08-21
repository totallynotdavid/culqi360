import { type JSX } from "@solidjs/web";
import {
  children,
  createEffect,
  createMemo,
  createUniqueId,
  onCleanup,
} from "solid-js";

import { PopChild } from "./pop-child";
import { PresenceContext, type PresenceContextValue } from "./presence-context";

interface PresenceChildProps {
  key?: string;
  children: JSX.Element;
  isPresent: boolean;
  onExitComplete?: () => void;
  initial?: false | string | string[];
  custom?: any;
  presenceAffectsLayout: boolean;
  mode: "sync" | "popLayout" | "wait";
  anchorX?: "left" | "right";
  anchorY?: "top" | "bottom";
  root?: HTMLElement | ShadowRoot;
}

export function PresenceChild(props: PresenceChildProps) {
  const id = createUniqueId();
  const content = children(() => props.children);
  const presenceChildren = new Map<string, boolean>();

  const context = createMemo<PresenceContextValue>(() => ({
    id,
    isPresent: () => props.isPresent,
    initial: props.initial,
    custom: props.custom,
    onExitComplete: (childId: string) => {
      presenceChildren.set(childId, true);
      for (const isComplete of presenceChildren.values()) {
        if (!isComplete) {
          return;
        }
      }
      props.onExitComplete?.();
    },
    register: (childId: string) => {
      presenceChildren.set(childId, false);
      return () => {
        presenceChildren.delete(childId);
      };
    },
  }));

  createEffect(
    () => props.isPresent,
    (isPresent) => {
      if (!isPresent) {
        if (presenceChildren.size === 0) {
          props.onExitComplete?.();
        }
        return;
      }

      presenceChildren.forEach((_, key) => {
        presenceChildren.set(key, false);
      });
    },
  );

  onCleanup(() => {
    presenceChildren.clear();
  });

  return (
    <PresenceContext value={context()}>
      {props.mode === "popLayout" ? (
        <PopChild
          isPresent={props.isPresent}
          anchorX={props.anchorX}
          anchorY={props.anchorY}
          root={props.root}
        >
          {content()}
        </PopChild>
      ) : (
        content()
      )}
    </PresenceContext>
  );
}

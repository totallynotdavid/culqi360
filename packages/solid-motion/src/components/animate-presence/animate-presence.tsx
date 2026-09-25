import { resolveElements } from "@solid-primitives/refs";
import { createListTransition } from "@solid-primitives/transition-group";
import { type JSX } from "@solidjs/web";
import { type FlowComponent } from "solid-js";

import type { MotionState } from "../../state";
import { mountedStates } from "../../state";
import { AnimatePresenceContext, type PresenceContext } from "./presence";
import type { AnimatePresenceProps } from "./types";
import { usePopLayout } from "./use-pop-layout";

let apId = 0;

// Keeps exiting Motion children rendered until their exit animation completes.
export const AnimatePresence: FlowComponent<AnimatePresenceProps> = (props) => {
  const presenceId = String(apId++);
  const { addPopStyle, removePopStyle } = usePopLayout(props);

  const context: PresenceContext = {
    get initial() {
      return props.initial;
    },
    get custom() {
      return props.custom;
    },
    presenceId,
    onMotionExitComplete,
  };

  // Each exiting state settles its own list-transition removal callback.
  const exiting = new Map<MotionState, () => void>();

  function onMotionExitComplete(
    _container: HTMLElement | null,
    state: MotionState,
  ) {
    const finish = exiting.get(state);
    if (!finish) return;
    exiting.delete(state);
    finish();
  }

  const stateFor = (el: Element) => mountedStates.get(el);

  function handleChange(payload: {
    added: Element[];
    removed: Element[];
    finishRemoved: (els: Element[]) => void;
  }) {
    const { added, removed, finishRemoved } = payload;

    for (const el of added) {
      const state = stateFor(el);
      if (!state) continue;
      state.setActive("exit", false);
      state.captureLayoutSnapshot(state.options, true);
    }

    if (removed.length === 0) return;

    const states = removed.map(stateFor).filter(Boolean) as MotionState[];
    const finish = () => {
      for (const el of removed) removePopStyle(el as HTMLElement);
      finishRemoved(removed);
    };

    if (states.length === 0) {
      finish();
      props.onExitComplete?.();
      return;
    }

    let remaining = states.length;
    const settleOne = () => {
      if (--remaining === 0) {
        finish();
        props.onExitComplete?.();
      }
    };

    for (const el of removed) addPopStyle(el as HTMLElement);
    for (const state of states) {
      exiting.set(state, settleOne);
      state.presenceContainer = state.element as HTMLElement;
      state.setActive("exit", true);
      state.captureLayoutSnapshot(state.options, false);
    }
    states[0]?.notifyLayoutUpdate();
  }

  return (
    <AnimatePresenceContext value={context}>
      {(() => {
        const rendered = createListTransition(
          () => resolveElements(() => props.children).toArray() as Element[],
          {
            appear: props.initial ?? true,
            exitMethod:
              props.mode === "popLayout" ? "keep-index" : "move-to-end",
            onChange: handleChange,
          },
        );
        return <>{rendered() as unknown as JSX.Element}</>;
      })()}
    </AnimatePresenceContext>
  );
};

export const Presence = AnimatePresence;

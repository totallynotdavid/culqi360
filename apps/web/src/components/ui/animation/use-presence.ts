import {
  createMemo,
  createUniqueId,
  onCleanup,
  onSettled,
  type Accessor,
  useContext,
} from "solid-js";

import { PresenceContext } from "./presence-context";

type PresenceTuple = [Accessor<boolean>, (() => void) | null];

export function usePresence(subscribe = true): PresenceTuple {
  const context = useContext(PresenceContext);
  if (context === null) {
    return [() => true, null];
  }

  const id = createUniqueId();
  let unregister: (() => void) | undefined;
  const isPresent = createMemo(() => context.isPresent());

  onSettled(() => {
    if (!subscribe) {
      return;
    }
    unregister = context.register(id);
  });

  onCleanup(() => unregister?.());

  const safeToRemove = () => {
    if (!subscribe) {
      return;
    }
    context.onExitComplete?.(id);
  };

  return [isPresent, subscribe ? safeToRemove : null];
}

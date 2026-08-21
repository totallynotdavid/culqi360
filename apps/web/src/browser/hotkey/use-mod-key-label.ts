import { createSignal, onSettled, type Accessor } from "solid-js";

import { isMac } from "./hotkey-utils";

export function useModKeyLabel(): Accessor<string> {
  // Keep the initial value stable across SSR and hydration.
  const [label, setLabel] = createSignal("Ctrl");

  onSettled(() => {
    if (isMac()) {
      setLabel("⌘");
    }
  });

  return label;
}

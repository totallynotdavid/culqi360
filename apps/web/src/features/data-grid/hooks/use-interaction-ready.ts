import { createSignal, onSettled } from "solid-js";

export function createDataGridInteractionReady() {
  const [isInteractive, setIsInteractive] = createSignal(false);

  onSettled(() => {
    setIsInteractive(true);
  });

  return isInteractive;
}

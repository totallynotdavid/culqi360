import { MotionValue } from "motion-dom";
import { onCleanup } from "solid-js";

import type { WillChange } from "./types";

/** Implements `WillChange` without requiring a motion-dom `VisualElement`. */
class WillChangeValue extends MotionValue<string> implements WillChange {
  private readonly names = new Set<string>();

  add(name: string): void {
    if (this.names.has(name)) return;
    this.names.add(name);
    this.set([...this.names].join(", "));
  }
}

/**
 * Creates a `will-change` value that retains each property name, allowing
 * multiple animations to contribute without removing another's hint.
 */
export function createWillChange(): WillChange {
  const value = new WillChangeValue("auto");
  onCleanup(() => value.destroy());
  return value;
}

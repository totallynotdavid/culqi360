import { isServer } from "@solidjs/web";
import { createEffect, type Accessor } from "solid-js";

import { matchesEvent, parseCombo } from "./hotkey-utils";
import type { HotkeyCombo } from "./types";

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTypingContext(event: KeyboardEvent): boolean {
  const target = event.target;

  if (!(target instanceof Element)) {
    return false;
  }

  if (INPUT_TAGS.has(target.tagName)) {
    return true;
  }

  if (target.getAttribute("contenteditable") != null) {
    return true;
  }

  return false;
}

interface UseHotkeyOptions {
  enabled?: Accessor<boolean>;
  allowInInputs?: boolean;
  preventDefault?: boolean;

  // Needed for layout-dependent characters such as "/" on Latin American
  // keyboards, where the character itself requires Shift.
  ignoreModifiers?: boolean;

  shouldHandleEvent?: (event: KeyboardEvent) => boolean;
}

// Element-scoped keys such as Escape inside an input should use onKeyDown.
export function useHotkey(
  combo: HotkeyCombo,
  handler: (event: KeyboardEvent) => void,
  options: UseHotkeyOptions = {},
): void {
  const {
    enabled,
    allowInInputs = false,
    preventDefault = true,
    ignoreModifiers = false,
    shouldHandleEvent,
  } = options;

  // Solid 2 runs an effect's compute phase during SSR (only the apply phase is
  // client-only), and callers routinely gate `enabled` on `document.activeElement`
  // or similar. A key binding has no meaning on the server, so the whole hook
  // bails here: `isServer` is a build-time constant, so it drops out of the SSR
  // bundle instead of every caller having to write an SSR-safe predicate.
  if (isServer) {
    return;
  }

  const parsed = parseCombo(combo);

  createEffect(
    () => enabled?.() ?? true,
    (isEnabled) => {
      if (!isEnabled) {
        return;
      }

      const listener = (event: KeyboardEvent) => {
        if (!allowInInputs && isTypingContext(event)) {
          return;
        }

        if (shouldHandleEvent && !shouldHandleEvent(event)) {
          return;
        }

        if (!matchesEvent(event, parsed, { ignoreModifiers })) {
          return;
        }

        if (preventDefault) {
          event.preventDefault();
        }

        handler(event);
      };

      document.addEventListener("keydown", listener);

      // The effect phase's return value is the cleanup, so onCleanup is no
      // longer needed to unbind before the next run.
      return () => document.removeEventListener("keydown", listener);
    },
  );
}

import type { HotkeyCombo, ParsedCombo } from "./types";

export function isMac(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (navigator.platform ?? navigator.userAgent)
    .toLowerCase()
    .includes("mac");
}

export function parseCombo(combo: HotkeyCombo): ParsedCombo {
  const parts = combo.split("+");
  let ctrl = false;
  let shift = false;
  let alt = false;
  let meta = false;

  for (const part of parts.slice(0, -1)) {
    switch (part.toLowerCase()) {
      case "mod":
        if (isMac()) {
          meta = true;
        } else {
          ctrl = true;
        }
        break;

      case "control":
      case "ctrl":
        ctrl = true;
        break;

      case "shift":
        shift = true;
        break;

      case "alt":
        alt = true;
        break;

      case "meta":
        meta = true;
        break;
    }
  }

  const rawKey = parts.at(-1) ?? "";
  const key = rawKey.length === 1 ? rawKey.toUpperCase() : rawKey;

  return { key, ctrl, shift, alt, meta };
}

export function matchesEvent(
  event: KeyboardEvent,
  parsed: ParsedCombo,
  options: { ignoreModifiers?: boolean } = {},
): boolean {
  if (
    !options.ignoreModifiers &&
    (event.ctrlKey !== parsed.ctrl ||
      event.shiftKey !== parsed.shift ||
      event.altKey !== parsed.alt ||
      event.metaKey !== parsed.meta)
  ) {
    return false;
  }

  const { key: target } = parsed;

  if (target.length === 1 && /^[A-Z]$/.test(target)) {
    if (event.key.toUpperCase() === target) {
      return true;
    }

    // macOS Option+letter may report "Dead"; `code` still identifies the key.
    if (event.key === "Dead" && event.code.startsWith("Key")) {
      return event.code.slice(3).toUpperCase() === target;
    }

    return false;
  }

  return event.key === target;
}

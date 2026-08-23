import { addDomEvent, hover, press } from "motion-dom";

/**
 * The gesture states an element can be in, lowest priority first. `animate`
 * sits below all of them and `exit` above, matching Motion's own order.
 */
export const gestureNames = ["whileFocus", "whileHover", "whilePress"] as const;

export type GestureName = (typeof gestureNames)[number];

/**
 * Starts watching one gesture and returns the disposer the owning scope needs.
 *
 * Hover and press come from motion-dom rather than from `pointerenter` and
 * `pointerdown` listeners written here. They are not thin wrappers: hover
 * filters polyfilled touch events, defers its end while a press is in flight so
 * a button does not flicker when the pointer slips off mid-click, and backs off
 * while a drag is active. Press filters secondary and multi-touch pointers,
 * ends on the capture phase so a child calling `stopPropagation` cannot strand
 * it, and drives the same gesture from Enter keydown/keyup for keyboards.
 */
export function observeGesture(
  name: GestureName,
  element: HTMLElement | SVGElement,
  setActive: (active: boolean) => void,
): VoidFunction {
  if (name === "whileHover") {
    return hover(element, () => {
      setActive(true);
      return () => setActive(false);
    });
  }

  if (name === "whilePress") {
    return press(element, () => {
      setActive(true);
      return () => setActive(false);
    });
  }

  return observeFocus(element, setActive);
}

/**
 * Focus only counts when the browser would have drawn a focus ring. Activating
 * on every `focus` would light the element up on a plain mouse click, which is
 * not what a focus style means.
 *
 * A browser without `:focus-visible` throws on the selector and draws its
 * default outline for all focus, so treating the throw as visible keeps the
 * animation consistent with what that browser paints.
 */
function observeFocus(
  element: HTMLElement | SVGElement,
  setActive: (active: boolean) => void,
): VoidFunction {
  const onFocus = () => {
    let isFocusVisible: boolean;
    try {
      isFocusVisible = element.matches(":focus-visible");
    } catch {
      isFocusVisible = true;
    }
    if (isFocusVisible) setActive(true);
  };

  const removeFocus = addDomEvent(element, "focus", onFocus);
  const removeBlur = addDomEvent(element, "blur", () => setActive(false));

  return () => {
    removeFocus();
    removeBlur();
  };
}

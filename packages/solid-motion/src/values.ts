import {
  MotionValue,
  animateMotionValue,
  getComputedStyle,
  readTransformValue,
  styleEffect,
  transformProps,
  type AnimationPlaybackControlsWithThen,
  type Transition,
  type ValueKeyframesDefinition,
} from "motion-dom";

/**
 * The animated properties of one element, one `MotionValue` each.
 *
 * Everything below the value boundary belongs to motion-dom: `styleEffect`
 * composes the shared `transform` string in motion's canonical order, applies
 * per-property unit defaults, routes custom properties through `setProperty`,
 * and sets `transform-box` on SVG. This module only decides which values exist
 * and what they are told to do.
 */
export interface ValueStore {
  /**
   * Animates one property towards `keyframe`, creating and binding the value
   * on first use. Returns the running animation, or `undefined` when motion
   * resolved the target instantly and never created one.
   */
  animate(
    key: string,
    keyframe: ValueKeyframesDefinition,
    transition: Transition | undefined,
  ): AnimationPlaybackControlsWithThen | undefined;
  /** Sets a property without animating, used for `transitionEnd`. */
  set(key: string, value: string | number): void;
  /**
   * The value this property was bound at, which is where it returns when the
   * layer that was driving it stops contributing. `undefined` until the
   * property has been animated at least once.
   */
  baseValue(key: string): string | number | undefined;
  /** Subscribes to every animated property's per-frame value. */
  observe(listener: (latest: Record<string, string | number>) => void): void;
  dispose(): void;
}

export function createValueStore(
  element: HTMLElement | SVGElement,
  /** Where a property starts when the element was rendered carrying it. */
  initialValues: Record<string, string | number>,
  /**
   * Values the caller owns, from `style`. Bound like any other, but never
   * created or destroyed here: the scope that made them decides when they end,
   * and animating one writes to the same value the caller reads.
   */
  bound: ReadonlyMap<string, MotionValue>,
): ValueStore {
  const values = new Map<string, MotionValue>();
  const bases = new Map<string, string | number>();
  const unbind: VoidFunction[] = [];
  let observer: ((latest: Record<string, string | number>) => void) | undefined;
  const latest: Record<string, string | number> = {};

  const attach = (key: string, value: MotionValue, base: string | number) => {
    values.set(key, value);
    bases.set(key, base);
    unbind.push(styleEffect(element, { [key]: value }));
    if (observer) subscribe(key, value);
  };

  // Bound up front rather than on first use. A caller's value is already the
  // element's appearance, so it has to be attached whether anything animates it
  // or not.
  for (const [key, value] of bound) {
    attach(key, value, value.get() as string | number);
  }

  const ensure = (key: string): MotionValue => {
    const existing = values.get(key);
    if (existing) return existing;

    // Created empty, then written. `MotionValueState` only repaints the shared
    // transform composite when one of its inputs actually changes, so a value
    // constructed at its starting number would leave `transform` stale until
    // something else moved. Constructing empty makes the first write a change.
    const value = new MotionValue<string | number | undefined>(undefined);
    const base = readStartValue(element, key, initialValues);
    attach(key, value as MotionValue, base);
    value.jump(base, false);

    return value as MotionValue;
  };

  const subscribe = (key: string, value: MotionValue) => {
    unbind.push(
      value.on("change", (current: string | number) => {
        latest[key] = current;
        observer?.(latest);
      }),
    );
  };

  return {
    animate(key, keyframe, transition) {
      const value = ensure(key);

      // `animateMotionValue` is named on purpose. Motion picks its default
      // transition from the property name (transforms spring, scale springs
      // critically damped, everything else eases), and it is what reads
      // per-property overrides out of `transition`. The `animateSingleValue`
      // helper passes an empty name and silently loses both.
      value.start(animateMotionValue(key, value, keyframe, transition));

      return value.animation;
    },

    set(key, value) {
      ensure(key).jump(value);
    },

    baseValue(key) {
      return bases.get(key);
    },

    observe(listener) {
      observer = listener;
      for (const [key, value] of values) subscribe(key, value);
    },

    dispose() {
      for (const cancel of unbind) cancel();
      for (const [key, value] of values) {
        if (!bound.has(key)) value.destroy();
      }
      values.clear();
      bases.clear();
      unbind.length = 0;
    },
  };
}

/**
 * Where an animation starts when the target names a property the element was
 * not rendered with. Transforms have to come out of the computed matrix rather
 * than the computed style, which reports `transform` as `matrix(...)` and has
 * no notion of an `x` or a `rotate`.
 */
function readStartValue(
  element: HTMLElement | SVGElement,
  key: string,
  initialValues: Record<string, string | number>,
): string | number {
  const rendered = initialValues[key];
  if (rendered !== undefined) return rendered;

  if (transformProps.has(key)) {
    return readTransformValue(element as HTMLElement, key);
  }

  return toNumberIfUnitless(getComputedStyle(element, key) || 0);
}

/**
 * `getComputedStyle` reports even unitless properties as strings, and motion
 * refuses to interpolate the string `"1"` towards the number `0` because a bare
 * string carries no value type it can mix. Motion's own reader gets away with
 * it by handing the resolver a `VisualElement` that re-types the keyframe from
 * the DOM; we have no visual element, so the typing happens here instead.
 *
 * Anything carrying a unit or a colour stays a string, where motion's value
 * types do recognise it.
 */
function toNumberIfUnitless(value: string | number): string | number {
  if (typeof value === "number") return value;

  const trimmed = value.trim();
  if (trimmed === "") return 0;

  const asNumber = Number(trimmed);
  return Number.isNaN(asNumber) ? trimmed : asNumber;
}

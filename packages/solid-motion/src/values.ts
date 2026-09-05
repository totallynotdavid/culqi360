import {
  DOMKeyframesResolver,
  MotionValue,
  animateMotionValue,
  buildHTMLStyles,
  getComputedStyle,
  isHTMLElement,
  measureViewportBox,
  readTransformValue,
  renderHTML,
  styleEffect,
  svgEffect,
  transformProps,
  type AnimationPlaybackControlsWithThen,
  type HTMLRenderState,
  type ResolvedValues,
  type Transition,
  type ValueKeyframesDefinition,
  type VisualElement,
} from "motion-dom";

import { attributeName } from "./svg";

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

/**
 * The one `ValueStore` an element may have. A `createMotion` binding and an
 * `animate()` call that targets the same node have to drive the same
 * `MotionValue` per key instead of each building their own: two independent
 * stores both calling `styleEffect` for, say, `x` leaves only the
 * most-recently-created one actually wired to the DOM (motion-dom's per-key
 * binding replaces whichever value held it before), so the other's writes go
 * nowhere. Sharing this store is what lets `ensure()` in `createValueStore`
 * hand back the existing `MotionValue` to whichever side asks second.
 */
const sharedStores = new WeakMap<Element, ValueStore>();

/**
 * Whoever claims the element first decides `initialValues` and `bound`; a
 * later claim reuses the store as-is. That matches the only ordering this
 * package produces one for: a `createMotion` ref fires as its element
 * mounts, before anything else could have a reference to that element to
 * hand to `animate()`.
 */
export function sharedValueStore(
  element: HTMLElement | SVGElement,
  initialValues: Record<string, string | number>,
  bound: ReadonlyMap<string, MotionValue>,
): ValueStore {
  const existing = sharedStores.get(element);
  if (existing) return existing;

  const store = createValueStore(element, initialValues, bound);
  sharedStores.set(element, store);
  return store;
}

/** Releases this element's slot so a later claim builds a fresh store. */
export function releaseValueStore(element: Element, store: ValueStore): void {
  if (sharedStores.get(element) === store) sharedStores.delete(element);
}

/**
 * Whoever is currently animating one element's property, so a later claim
 * on the same pair can settle whatever the earlier claimant was waiting on
 * instead of leaving it to wait on a `MotionValue` that just stopped
 * animating out from under it.
 *
 * Shared between `create-animate.ts`'s imperative calls and `controller.ts`'s
 * reactive pass, the two places that call `ValueStore.animate()`: a property
 * has exactly one `MotionValue` regardless of which side is driving it, so
 * motion-dom's own per-value `start()` stealing it from underneath a caller
 * (verified against motion-dom 13.1.1: it stops the previous animation
 * without ever settling that animation's own `finished`) needs one registry
 * both sides feed, not two that only know about their own calls.
 */
const claims = new WeakMap<Element, Map<string, VoidFunction>>();

export function claim(
  element: Element,
  key: string,
  onSuperseded: VoidFunction,
): void {
  let byKey = claims.get(element);
  if (!byKey) {
    byKey = new Map();
    claims.set(element, byKey);
  }
  byKey.get(key)?.();
  byKey.set(key, onSuperseded);
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

  // `svgEffect` routes per key rather than per element: `opacity` and
  // `transform` are style on an SVG node too, while `x1`, `r` and `viewBox` are
  // attributes, and `pathLength` becomes the `stroke-dasharray` pair that makes
  // a path draw itself. Setting any of the latter as style is inert, which is
  // what SVG animation did here before.
  const bindValue = isHTMLElement(element) ? styleEffect : svgEffect;

  const attach = (key: string, value: MotionValue, base: string | number) => {
    values.set(key, value);
    bases.set(key, base);
    unbind.push(bindValue(element, { [key]: value }));
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

  /**
   * The view of this element that motion's keyframe resolver works against.
   *
   * Animating `height` from a computed pixel value to `auto`, or between any
   * two incompatible units, needs a measurement: set the target, read the box,
   * put it back, then animate between the two numbers. Motion already does this
   * on its own frame loop, batching every element's reads before any writes so
   * a list of collapsing rows costs one layout pass rather than one each.
   *
   * `WithRender` is the five-member interface that machinery actually asks for,
   * so a value store can satisfy it directly. This is the narrow resolver shim
   * that adopting `VisualElement` was always the alternative to, and
   * `VisualElement` would bring a props model, a variant tree, an event system
   * and a projection node with it, all of which Solid's graph already covers or
   * this package does not want.
   *
   * HTML only. `renderHTML` and `measureViewportBox` both take an HTMLElement,
   * and without the view SVG keeps exactly the behaviour it has today.
   */
  const resolverView = isHTMLElement(element)
    ? {
        // Read off the element by `AsyncMotionValueAnimation`, which takes the
        // resolver class from whatever it is animating against.
        KeyframeResolver: DOMKeyframesResolver,
        current: element,

        // Called with a fallback only when the resolver intends to write the
        // key. Without one it is asking whether the value exists at all, which
        // is how transforms are stripped before a measurement and put back
        // after, so creating one there would defeat the question.
        getValue: (key: string, fallback?: string | number) => {
          const existing = values.get(key);
          if (existing || fallback === undefined) return existing;
          return ensure(key);
        },

        readValue: (key: string) => readStartValue(element, key, initialValues),

        // Synchronous on purpose. The resolver writes the target, measures and
        // restores inside one frame step, so a write scheduled for motion's
        // render step would land after the measurement that needed it.
        render: () => {
          const latestValues: ResolvedValues = {};
          for (const [key, value] of values) latestValues[key] = value.get();

          const state: HTMLRenderState = {
            transform: {},
            transformOrigin: {},
            style: {},
            vars: {},
          };
          buildHTMLStyles(state, latestValues);
          renderHTML(element, state);
        },

        measureViewportBox: () => measureViewportBox(element),
      }
    : undefined;

  return {
    animate(key, keyframe, transition) {
      const value = ensure(key);

      // `animateMotionValue` is named on purpose. Motion picks its default
      // transition from the property name (transforms spring, scale springs
      // critically damped, everything else eases), and it is what reads
      // per-property overrides out of `transition`. The `animateSingleValue`
      // helper passes an empty name and silently loses both.
      value.start(
        animateMotionValue(
          key,
          value,
          keyframe,
          transition,
          // Typed as `VisualElement` upstream but only ever read structurally:
          // `KeyframeResolver` in `AsyncMotionValueAnimation`, and the five
          // `WithRender` members in `KeyframeResolver` and
          // `DOMKeyframesResolver`. Verified against motion-dom 13.1.1;
          // nothing else on the parameter is touched on this path.
          resolverView as unknown as VisualElement,
        ),
      );

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

  // The computed style has no reading of `x1` or `r` at all: it answers the
  // empty string, so an animation from the element's own geometry would have
  // started from zero and jumped. Attributes first on an SVG node, style after,
  // since `fill` and `opacity` can be either.
  if (!isHTMLElement(element)) {
    const attribute = element.getAttribute(attributeName(key));
    if (attribute !== null) return toNumberIfUnitless(attribute);
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

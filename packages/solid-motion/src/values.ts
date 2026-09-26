import {
  DOMKeyframesResolver,
  MotionValue,
  animateMotionValue,
  buildHTMLStyles,
  frame,
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

import { claimInlineStyle, releaseInlineStyle } from "./layout-updates";
import {
  createProjection,
  type LayoutOptions,
  type LayoutTiming,
} from "./projection";
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
  /** Applies `transitionEnd` values without starting an animation. */
  set(key: string, value: string | number): void;
  /**
   * The value this property was bound at, which is where it returns when the
   * layer that was driving it stops contributing. `undefined` until the
   * property has been animated at least once.
   */
  baseValue(key: string): string | number | undefined;
  /** Subscribes to every animated property's per-frame value. */
  observe(listener: (latest: Record<string, string | number>) => void): void;
  /** Updates layout timing. Ignored when the element has no layout. */
  setLayoutTiming(timing: LayoutTiming): void;
  dispose(): void;
}

/**
 * Share one `ValueStore` per element. A `createMotion` binding and an
 * `animate()` call targeting the same node must drive the same `MotionValue`
 * for each key. If both stores call `styleEffect` for a key, motion-dom's
 * per-key binding replaces the earlier binding, so the first store's writes
 * go nowhere. Sharing the store lets `ensure()` return the existing value to
 * whichever side asks second.
 */
const sharedStores = new WeakMap<Element, ValueStore>();

/**
 * The first call fixes `initialValues`, `bound`, and `layout`. Later calls reuse
 * the store. The controller creates it from its mount ref before it starts any
 * queued pass, so animation work sees an initialized store.
 */
export function sharedValueStore(
  element: HTMLElement | SVGElement,
  initialValues: Record<string, string | number>,
  bound: ReadonlyMap<string, MotionValue>,
  layout?: LayoutOptions,
): ValueStore {
  const existing = sharedStores.get(element);
  if (existing) return existing;

  const store = createValueStore(element, initialValues, bound, layout);
  sharedStores.set(element, store);
  return store;
}

/** Releases the element slot when it still points to this store. */
export function releaseValueStore(element: Element, store: ValueStore): void {
  if (sharedStores.get(element) === store) sharedStores.delete(element);
}

/**
 * Track the current claimant for each element-property pair. A later claim
 * notifies the earlier caller instead of leaving it waiting on a `MotionValue`
 * that `MotionValue.start()` stopped.
 *
 * Both `create-animate.ts` and `controller.ts` use this registry. motion-dom
 * stops the previous animation when a new call starts on the same value but
 * does not settle its `finished`, so both paths must share the registry.
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
  /** Initial values rendered on the element. */
  initialValues: Record<string, string | number>,
  /** Caller-owned `style` values. This store must not create or destroy them. */
  bound: ReadonlyMap<string, MotionValue>,
  /** Present when the element asked for `layout` or `layoutId`. */
  layout?: LayoutOptions,
): ValueStore {
  const values = new Map<string, MotionValue>();
  const bases = new Map<string, string | number>();
  const unbind: VoidFunction[] = [];
  let observer: ((latest: Record<string, string | number>) => void) | undefined;

  /** Shared current values for rendering, projection, and `onUpdate`. */
  const latestValues: ResolvedValues = {};
  /** Reused because `buildHTMLStyles` clears styles using the existing state. */
  const renderState: HTMLRenderState = {
    transform: {},
    transformOrigin: {},
    style: {},
    vars: {},
  };

  // The layout watcher must read this store's inline-style writes as paint.
  claimInlineStyle(element);

  // Projection is HTML-only. SVG uses its normal property effects.
  const projection =
    layout && isHTMLElement(element)
      ? createProjection(element, latestValues, renderState, layout)
      : undefined;

  /** Writes current values with any projection transform composed on top. */
  const paint = projection
    ? projection.render
    : () => {
        buildHTMLStyles(renderState, latestValues);
        renderHTML(element as HTMLElement, renderState);
      };

  // Projection renders HTML values itself. Other nodes use motion-dom effects.
  const bindToDom = isHTMLElement(element) ? styleEffect : svgEffect;

  const attach = (key: string, value: MotionValue, base: string | number) => {
    values.set(key, value);
    bases.set(key, base);

    unbind.push(
      value.on("change", (current: string | number) => {
        latestValues[key] = current;
        if (projection) frame.render(paint);
        observer?.(latestValues);
      }),
    );
    if (!projection) unbind.push(bindToDom(element, { [key]: value }));

    const current = value.get() as string | number | undefined;
    if (current !== undefined) latestValues[key] = current;
  };

  // Bind caller-owned values immediately so they define the initial appearance.
  for (const [key, value] of bound) {
    attach(key, value, value.get() as string | number);
  }

  const ensure = (key: string): MotionValue => {
    const existing = values.get(key);
    if (existing) return existing;

    // Start empty so the first write refreshes motion's shared transform state.
    const value = new MotionValue<string | number | undefined>(undefined);
    const base = readStartValue(element, key, initialValues);
    attach(key, value as MotionValue, base);
    value.jump(base, false);

    return value as MotionValue;
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
   * The resolver needs only this element, the keyframe resolver, value access,
   * rendering, and measurement. Using `VisualElement` would also bring a props
   * model, a variant tree, and an event system that Solid's graph already
   * covers. Layout projection uses a narrow host for the same reason
   * (`getProps` and friends on `projection.ts`'s `host`): its engine reads from
   * the object it animates, not from the full object that normally owns it.
   *
   * This adapter is for HTML only. `renderHTML` and `measureViewportBox` both
   * take an `HTMLElement`, so SVG keeps its current behavior when no view is
   * provided.
   */
  const resolverView = isHTMLElement(element)
    ? {
        // The resolver reads `KeyframeResolver` from this view.
        KeyframeResolver: DOMKeyframesResolver,
        current: element,

        // The resolver passes a fallback before writing. Preserve the
        // distinction between an absent value and an existing one.
        getValue: (key: string, fallback?: string | number) => {
          const existing = values.get(key);
          if (existing || fallback === undefined) return existing;
          return ensure(key);
        },

        readValue: (key: string) => readStartValue(element, key, initialValues),

        // Resolver measurement writes and restores synchronously.
        render: paint,

        measureViewportBox: () => measureViewportBox(element),
      }
    : undefined;

  return {
    animate(key, keyframe, transition) {
      const value = ensure(key);

      // Motion derives the default and per-property transition from the key.
      const startAnimation = animateMotionValue(
        key,
        value,
        keyframe,
        transition,
        // The resolver reads only this narrow adapter at this boundary.
        resolverView as unknown as VisualElement,
      );
      let animation: AnimationPlaybackControlsWithThen | undefined;
      value.start((complete) => {
        animation = startAnimation(complete);
        return animation;
      });

      return animation;
    },

    set(key, value) {
      ensure(key).jump(value);
    },

    baseValue(key) {
      return bases.get(key);
    },

    observe(listener) {
      observer = listener;
    },

    setLayoutTiming(timing) {
      projection?.setTiming(timing);
    },

    dispose() {
      projection?.dispose();
      releaseInlineStyle(element);
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
 * Reads a missing starting value. Transforms come from the computed matrix,
 * because computed style exposes only the combined `transform` value.
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

  // SVG geometry lives in attributes.
  // Properties such as `fill` can use either attributes or styles.
  if (!isHTMLElement(element)) {
    const attribute = element.getAttribute(attributeName(key));
    if (attribute !== null) return toNumberIfUnitless(attribute);
  }

  return toNumberIfUnitless(getComputedStyle(element, key) || 0);
}

/** Converts unitless style values to numbers for interpolation. */
function toNumberIfUnitless(value: string | number): string | number {
  if (typeof value === "number") return value;

  const trimmed = value.trim();
  if (trimmed === "") return 0;

  const asNumber = Number(trimmed);
  return Number.isNaN(asNumber) ? trimmed : asNumber;
}

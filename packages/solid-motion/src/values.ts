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
  /** Updates layout timing. Ignored when the element has no layout. */
  setLayoutTiming(timing: LayoutTiming): void;
  dispose(): void;
}

export function createValueStore(
  element: HTMLElement | SVGElement,
  /** Where a property starts when the element was rendered carrying it. */
  initialValues: Record<string, string | number>,
  /** Caller-owned values from `style`, which this store must not create or destroy. */
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

  // Every value this store writes lands in the element's inline style, so the
  // layout watcher must read those writes as paint rather than as movement.
  claimInlineStyle(element);

  // Projection supports HTML only. SVG keeps its existing property effects.
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

  // Projecting HTML nodes use `render`; SVG and non-projecting HTML use effects.
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

  // Bind caller-owned values immediately because they already define the element's
  // rendered appearance.
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

  /** Adapter used by motion's HTML keyframe resolver. */
  const resolverView = isHTMLElement(element)
    ? {
        // `AsyncMotionValueAnimation` takes the resolver class from this view.
        KeyframeResolver: DOMKeyframesResolver,
        current: element,

        // A fallback means the resolver is about to write; otherwise preserve
        // the distinction between an absent value and an existing one.
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

      // The property name supplies motion's default and per-property transition.
      value.start(
        animateMotionValue(
          key,
          value,
          keyframe,
          transition,
          // This adapter supplies the members read by the resolver.
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

  // SVG geometry lives in attributes, while properties such as `fill` can use
  // either attributes or styles.
  if (!isHTMLElement(element)) {
    const attribute = element.getAttribute(attributeName(key));
    if (attribute !== null) return toNumberIfUnitless(attribute);
  }

  return toNumberIfUnitless(getComputedStyle(element, key) || 0);
}

/** Converts unitless computed-style strings to numbers for interpolation. */
function toNumberIfUnitless(value: string | number): string | number {
  if (typeof value === "number") return value;

  const trimmed = value.trim();
  if (trimmed === "") return 0;

  const asNumber = Number(trimmed);
  return Number.isNaN(asNumber) ? trimmed : asNumber;
}

import {
  HTMLProjectionNode,
  buildHTMLStyles,
  frame,
  measureViewportBox,
  renderHTML,
  type HTMLRenderState,
  type IProjectionNode,
  type MotionStyle,
  type ResolvedValues,
  type Transition,
  type VisualElement,
} from "motion-dom";

import { adoptLayoutNode, dropLayoutNode } from "./layout-updates";

/** Which parts of a layout change are animated. */
export type LayoutOption = boolean | "position" | "size" | "x" | "y";

export interface LayoutOptions {
  layout: LayoutOption | undefined;
  layoutId: string | undefined;
  /**
   * The style entries the DOM owns, which projection needs so it can put back
   * what it takes over. Taking an element over clears its `pointerEvents`, and
   * the caller's value is the only record of what to restore. Entries motion
   * drives are not at risk: they are repainted from `latestValues` on every
   * frame.
   */
  style: Record<string, unknown> | undefined;
}

/** Timing refreshed by the controller for each pass. */
export interface LayoutTiming {
  transition: Transition | undefined;
  /** Whether the change should apply immediately. */
  instant: boolean;
}

export interface Projection {
  /** Paints the element with its projection transform. */
  render(): void;
  setTiming(timing: LayoutTiming): void;
  dispose(): void;
}

/** Adapts an HTML projection node to the small host surface Solid provides. */
export function createProjection(
  element: HTMLElement,
  /** The element's animated values, which the node projects on top of. */
  latestValues: ResolvedValues,
  /** Shared with the value store, so one paint writes both sets of styles. */
  renderState: HTMLRenderState,
  options: LayoutOptions,
): Projection {
  let node: IProjectionNode | undefined;
  const timing: LayoutTiming = { transition: undefined, instant: false };

  const styleProp = toMotionStyle(options.style);

  const render = () => {
    buildHTMLStyles(renderState, latestValues);
    // Passing the node lets projection compose its transform over the base style.
    renderHTML(element, renderState, styleProp, node);
  };

  const host = {
    current: element,
    latestValues,
    props: {},
    renderState,
    getProps: () => ({}),
    getDefaultTransition: () => timing.transition,
    get shouldReduceMotion() {
      return timing.instant;
    },
    // Layout callbacks are not part of the Solid API.
    notify: () => {},
    measureViewportBox: () => measureViewportBox(element),
    scheduleRender: () => {
      frame.render(render);
    },
    render,
    setStaticValue: (key: string, value: string | number) => {
      latestValues[key] = value;
    },
  };

  adoptLayoutNode(element, {
    instant: () => timing.instant,
    create(parent) {
      // The projection node's host type is wider than the concrete HTML node's
      // type, so erase only that type parameter at this boundary.
      node = new HTMLProjectionNode(
        latestValues,
        parent,
      ) as unknown as IProjectionNode;

      node.setOptions({
        // `layoutId` alone also enables projection.
        layout: options.layout ? true : undefined,
        layoutId: options.layoutId,
        animationType:
          typeof options.layout === "string" ? options.layout : "both",
        // Match Motion's shared-element default.
        crossfade: true,
        visualElement: host as unknown as VisualElement,
      });

      return node;
    },
  });

  return {
    render,
    setTiming(next) {
      timing.transition = next.transition;
      timing.instant = next.instant;
    },
    dispose() {
      dropLayoutNode(element);
      node = undefined;
    },
  };
}

/**
 * The caller's style as motion spells it. Motion looks its own entries up by
 * property name (`pointerEvents`), while a Solid style object is written the
 * way CSS spells them, because Solid sets an object entry with `setProperty`.
 * A `pointer-events: none` the caller set is only restored if it arrives under
 * the name motion looks for. Custom properties are left alone: they are CSS
 * names all the way down, and motion never reads one from here.
 */
function toMotionStyle(
  style: Record<string, unknown> | undefined,
): MotionStyle | undefined {
  if (!style) return undefined;

  const named: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) {
    named[key.startsWith("--") ? key : dashToCamel(key)] = value;
  }
  return named as MotionStyle;
}

function dashToCamel(key: string): string {
  return key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

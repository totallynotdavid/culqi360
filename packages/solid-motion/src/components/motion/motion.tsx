import { combineStyle } from "@solid-primitives/props";
import { type JSX } from "@solidjs/web";
import { Dynamic } from "@solidjs/web";
import { createEffect, omit, onCleanup, onSettled } from "solid-js";

import { domMax } from "../../features/dom-max";
import { updateLazyFeatures } from "../../features/lazy-features";
import { MotionState } from "../../state";
import { createVisualElement } from "../../state/create-visual-element";
import { createStyles, createSVGStyles } from "../../state/style";
import type { Options } from "../../types";
import { resolveMotionProps } from "../../utils/resolve-motion-props";
import { usePresenceContext } from "../animate-presence/presence";
import {
  MotionContext,
  useLayoutGroupContext,
  useParentMotionState,
} from "../context";
import { useMotionConfig } from "../motion-config/context";
import { OPTION_KEYS } from "./option-keys";

// Register the full DOM feature set once; MotionState creates features from this registry.
updateLazyFeatures(domMax.features);

export type MotionProps = Partial<Options> & {
  tag?: keyof JSX.IntrinsicElements;
  ref?: (el: Element) => void;
  children?: JSX.Element;
};

export type MotionComponent = {
  (props: JSX.IntrinsicElements["div"] & MotionProps): JSX.Element;
  <T extends keyof JSX.IntrinsicElements>(
    props: JSX.IntrinsicElements[T] & MotionProps & { tag: T },
  ): JSX.Element;
};

export type MotionProxy = MotionComponent & {
  [K in keyof JSX.IntrinsicElements]: (
    props: JSX.IntrinsicElements[K] & MotionProps,
  ) => JSX.Element;
};

function buildInitialStyle(
  state: MotionState,
  styleProp: unknown,
): JSX.CSSProperties | undefined {
  const values = state.visualElement?.latestValues ?? state.latestValues;
  const base =
    typeof styleProp === "object" && styleProp
      ? (styleProp as Record<string, any>)
      : {};
  const merged: Record<string, any> = { ...base, ...values };

  if (state.type === "svg") {
    const { style } = createSVGStyles(
      merged,
      (state.options.as as string) ?? "svg",
      base,
    );
    return style as JSX.CSSProperties;
  }

  const style = createStyles(merged);

  // Prevent text selection while the element owns pointer movement for a drag.
  const drag = state.options.drag;
  if (drag && state.options.dragListener !== false) {
    return {
      ...(style ?? {}),
      "user-select": "none",
      "-webkit-user-select": "none",
      "-webkit-touch-callout": "none",
      "touch-action":
        drag === true ? "none" : `pan-${drag === "x" ? "y" : "x"}`,
    } as JSX.CSSProperties;
  }

  return (style ?? undefined) as JSX.CSSProperties | undefined;
}

const MotionComponentImpl = (
  props: MotionProps & Record<string, any>,
): JSX.Element => {
  const parentState = useParentMotionState();
  const layoutGroup = useLayoutGroupContext();
  const presenceContext = usePresenceContext();
  const config = useMotionConfig();

  // Solid 2 dropped splitProps; omit keeps the DOM attributes reactive while
  // the engine options are read back off props one key at a time below.
  const attrs = omit(props, ...OPTION_KEYS, "tag", "ref", "children");

  const motionOptions = (): Options => {
    const options: Record<string, unknown> = {};

    for (const key of OPTION_KEYS) {
      if (key in props) {
        options[key] = props[key];
      }
    }

    return options as Options;
  };

  const getMotionProps = (): Options =>
    resolveMotionProps(
      { ...motionOptions(), as: props.tag ?? "div" },
      {
        layoutGroup,
        presenceContext,
        config,
      },
    );

  let root!: HTMLElement | SVGElement;
  const state = new MotionState(getMotionProps(), parentState);
  state.initVisualElement(createVisualElement);

  onSettled(() => state.mount(root));

  // Deferred because the constructor already applied the initial options.
  createEffect(
    getMotionProps,
    (motionProps) => {
      state.beforeUpdate();
      state.updateOptions(motionProps);
      state.update();
    },
    { defer: true },
  );

  onCleanup(() => {
    state.beforeUnmount();
    // Presence keeps an exiting element connected until its exit animation settles.
    if (!root?.isConnected) state.unmount();
  });

  return (
    <MotionContext value={state}>
      <Dynamic
        component={props.tag ?? "div"}
        {...attrs}
        ref={(el: Element) => {
          root = el as HTMLElement | SVGElement;
          props.ref?.(el);
        }}
        style={combineStyle(
          props.style as any,
          buildInitialStyle(state, props.style),
        )}
      >
        {props.children}
      </Dynamic>
    </MotionContext>
  );
};

/**
 * Renders an animatable HTML or SVG element.
 *
 * @example
 * ```tsx
 * <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
 * ```
 */
export const Motion = new Proxy(MotionComponentImpl, {
  get: (_, tag: string) => (props: MotionProps & Record<string, any>) => (
    <MotionComponentImpl {...props} tag={tag as keyof JSX.IntrinsicElements} />
  ),
}) as unknown as MotionProxy;

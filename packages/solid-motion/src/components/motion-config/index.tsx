import { type FlowComponent, merge, omit } from "solid-js";

import { MotionConfigContext, defaultConfig, useMotionConfig } from "./context";
import type { MotionConfigProps } from "./types";

/**
 * Provides default motion configuration (transition, reduced-motion, nonce) to
 * every descendant <Motion>. Nested configs merge onto the parent's.
 */
export const MotionConfig: FlowComponent<MotionConfigProps> = (props) => {
  const parent = useMotionConfig();
  const value = merge(defaultConfig, parent, omit(props, "children"));

  return (
    <MotionConfigContext value={value}>{props.children}</MotionConfigContext>
  );
};

export { MotionConfigContext, defaultConfig, useMotionConfig } from "./context";
export type { MotionConfigProps, MotionConfigState } from "./types";

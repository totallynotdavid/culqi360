import {
  createContext,
  merge,
  useContext,
  type Element,
  type ParentProps,
} from "solid-js";

import type { MotionConfigState } from "./types";

export const defaultMotionConfig: MotionConfigState = {
  reducedMotion: "never",
  transition: undefined,
  skipAnimations: false,
};

export const MotionConfigContext = createContext(defaultMotionConfig);

export function useMotionConfig(): MotionConfigState {
  return useContext(MotionConfigContext);
}

export function MotionConfig(props: ParentProps<MotionConfigState>): Element {
  const parent = useMotionConfig();
  const config = merge(defaultMotionConfig, parent, props);

  return (
    <MotionConfigContext value={config}>{props.children}</MotionConfigContext>
  );
}

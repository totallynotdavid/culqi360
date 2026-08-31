import {
  createContext,
  merge,
  omit,
  useContext,
  type Element,
  type ParentProps,
} from "solid-js";

import type { MotionConfigState } from "./types";

const defaultMotionConfig: MotionConfigState = {
  reducedMotion: "never",
  transition: undefined,
  skipAnimations: false,
};

const MotionConfigContext = createContext(defaultMotionConfig);

export function useMotionConfig(): MotionConfigState {
  return useContext(MotionConfigContext);
}

export function MotionConfig(props: ParentProps<MotionConfigState>): Element {
  // The parent is already the default when there is no provider above, so
  // re-merging the default here would only restate it. `children` is dropped
  // because the context value is configuration, not a place to park the tree.
  const config = merge(useMotionConfig(), omit(props, "children"));

  return (
    <MotionConfigContext value={config}>{props.children}</MotionConfigContext>
  );
}

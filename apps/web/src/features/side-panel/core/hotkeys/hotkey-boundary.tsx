import { type JSX } from "@solidjs/web";
import {
  createContext,
  type ParentProps,
  useContext,
  type Accessor,
} from "solid-js";

import type { HotkeyScope } from "./types";

const HotkeyScopeContext = createContext<HotkeyScope>();

type HotkeyBoundaryProps = ParentProps<{
  class?: string;
  style?: JSX.CSSProperties;
}>;

export function HotkeyBoundary(props: HotkeyBoundaryProps) {
  let container: HTMLDivElement | undefined;
  const containerAccessor: Accessor<HTMLElement | undefined> = () => container;

  const scope: HotkeyScope = {
    container: containerAccessor,
  };

  return (
    <HotkeyScopeContext value={scope}>
      <div
        ref={(element) => {
          container = element;
        }}
        class={props.class}
        style={props.style}
      >
        {props.children}
      </div>
    </HotkeyScopeContext>
  );
}

export function useHotkeyScope() {
  const scope = useContext(HotkeyScopeContext);
  if (!scope) {
    throw new Error("useHotkeyScope must be used inside HotkeyBoundary");
  }
  return scope;
}

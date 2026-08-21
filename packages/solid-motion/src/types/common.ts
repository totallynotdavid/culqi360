import type { JSX } from "@solidjs/web";
import type { Component } from "solid-js";

export type ElementType = keyof JSX.IntrinsicElements;

// `as` accepts an intrinsic tag name, an arbitrary custom-element string, or a
// Solid component. The `(string & {})` member keeps intrinsic-tag literal
// autocompletion while still allowing any string.
export type AsTag =
  | keyof JSX.IntrinsicElements
  | (string & {})
  | Component<any>;

export type ComponentProps<T> = T extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[T]
  : T extends Component<infer P>
    ? P
    : Record<string, unknown>;

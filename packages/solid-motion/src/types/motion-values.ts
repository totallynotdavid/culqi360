import type { JSX } from "@solidjs/web";
import type { MotionValue } from "framer-motion/dom";

import type { ElementType } from "./common";
import type { Options } from "./state";

export interface CustomValueType {
  mix: (from: any, to: any) => (p: number) => number | string;
  toValue: () => number | string;
}

export type MakeCustomValueType<T> = { [K in keyof T]: T[K] | CustomValueType };

export type MakeMotion<T> = MakeCustomValueType<{
  [K in keyof T]:
    | T[K]
    | MotionValue<number>
    | MotionValue<string>
    | MotionValue<any>;
}>;

export type SVGAttributesAsMotionValues = MakeMotion<Record<string, any>>;

export type SVGAttributesWithMotionValues = Record<
  string,
  SVGAttributesAsMotionValues
>;

export type SetMotionValueType<T, Keys extends keyof T> = {
  [K in keyof T]: K extends Keys ? SVGAttributesAsMotionValues : T[K];
};

export type MotionHTMLAttributes<C extends ElementType> = Omit<
  JSX.IntrinsicElements[C],
  keyof Options | "style" | "as" | "asChild"
>;

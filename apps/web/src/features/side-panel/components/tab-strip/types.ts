import type { JSX } from "@solidjs/web";

export type TabIconComponent = (props: {
  size?: number;
  class?: string;
}) => JSX.Element;

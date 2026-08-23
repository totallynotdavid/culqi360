import { type JSX } from "@solidjs/web";
import { For, omit, type Component } from "solid-js";

const defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
} as const;

type SupportedSvgTag = "path" | "circle" | "rect" | "line" | "polyline";

export type IconNode = ReadonlyArray<
  readonly [SupportedSvgTag, Record<string, string>]
>;

export interface IconProps extends Omit<
  JSX.SvgSVGAttributes<SVGSVGElement>,
  "stroke-width" | "color"
> {
  color?: string;
  size?: string | number;
  strokeWidth?: string | number;
  absoluteStrokeWidth?: boolean;
  iconNode: IconNode;
  name?: string;
  title?: string;
}

/** What `createIcon` produces: an icon with its node and name already bound. */
export type IconComponent = Component<Omit<IconProps, "iconNode" | "name">>;

const SVG_NODE_RENDERERS: Record<
  SupportedSvgTag,
  (attrs: Record<string, string>) => JSX.Element
> = {
  path: (attrs) => <path {...attrs} />,
  circle: (attrs) => <circle {...attrs} />,
  rect: (attrs) => <rect {...attrs} />,
  line: (attrs) => <line {...attrs} />,
  polyline: (attrs) => <polyline {...attrs} />,
};

function hasA11yProp(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  for (const prop in props) {
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
      return true;
    }
  }

  return false;
}

export function IconBase(props: IconProps) {
  const rest = omit(
    props,
    "color",
    "size",
    "strokeWidth",
    "children",
    "class",
    "name",
    "title",
    "iconNode",
    "absoluteStrokeWidth",
  );

  const strokeWidth = () => {
    const width = Number(
      props.strokeWidth ?? defaultAttributes["stroke-width"],
    );
    if (!props.absoluteStrokeWidth) {
      return width;
    }

    return (width * 24) / Number(props.size ?? defaultAttributes.width);
  };
  const iconTitle = () => {
    const title = props.title ?? props.name;
    return typeof title === "string" && title.trim().length > 0
      ? title
      : "icon";
  };

  return (
    <svg
      {...defaultAttributes}
      width={props.size ?? defaultAttributes.width}
      height={props.size ?? defaultAttributes.height}
      stroke={props.color ?? defaultAttributes.stroke}
      stroke-width={strokeWidth()}
      class={["lucide", props.name && `lucide-${props.name}`, props.class]}
      aria-hidden={
        !props.children && !hasA11yProp(rest) && iconTitle() === "icon"
          ? "true"
          : undefined
      }
      {...rest}
    >
      <title>{iconTitle()}</title>
      <For each={props.iconNode}>
        {([elementName, attrs]) => SVG_NODE_RENDERERS[elementName](attrs)}
      </For>
      {props.children}
    </svg>
  );
}

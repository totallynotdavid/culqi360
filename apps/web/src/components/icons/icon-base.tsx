import { For, splitProps } from "solid-js";
import { type JSX } from "@solidjs/web";

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

function mergeClasses(...classes: Array<string | undefined>) {
  const out: string[] = [];

  for (const name of classes) {
    if (!name) {
      continue;
    }

    const trimmed = name.trim();
    if (!trimmed || out.includes(trimmed)) {
      continue;
    }

    out.push(trimmed);
  }

  return out.join(" ");
}

export function IconBase(props: IconProps) {
  const [local, rest] = splitProps(props, [
    "color",
    "size",
    "strokeWidth",
    "children",
    "class",
    "name",
    "title",
    "iconNode",
    "absoluteStrokeWidth",
  ]);

  const strokeWidth = () => {
    const width = Number(
      local.strokeWidth ?? defaultAttributes["stroke-width"],
    );
    if (!local.absoluteStrokeWidth) {
      return width;
    }

    return (width * 24) / Number(local.size ?? defaultAttributes.width);
  };
  const iconTitle = () => {
    const title = local.title ?? local.name;
    return typeof title === "string" && title.trim().length > 0
      ? title
      : "icon";
  };

  return (
    <svg
      {...defaultAttributes}
      width={local.size ?? defaultAttributes.width}
      height={local.size ?? defaultAttributes.height}
      stroke={local.color ?? defaultAttributes.stroke}
      stroke-width={strokeWidth()}
      class={mergeClasses(
        "lucide",
        local.name ? `lucide-${local.name}` : undefined,
        local.class,
      )}
      aria-hidden={
        !local.children && !hasA11yProp(rest) && iconTitle() === "icon"
          ? "true"
          : undefined
      }
      {...rest}
    >
      <title>{iconTitle()}</title>
      <For each={local.iconNode}>
        {([elementName, attrs]) => SVG_NODE_RENDERERS[elementName](attrs)}
      </For>
      {local.children}
    </svg>
  );
}

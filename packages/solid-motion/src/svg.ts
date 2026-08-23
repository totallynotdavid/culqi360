import { camelCaseAttributes, camelToDash } from "motion-dom";

/**
 * The tags that render an SVG element.
 *
 * Taken from motion's own list rather than inferred, because the interesting
 * entries are the ambiguous ones: `filter`, `image`, `mask`, `switch` and
 * `text` all read like HTML, and `a` and `script` are deliberately absent
 * because they are shared with HTML and the HTML reading is the common one.
 */
const svgTags = new Set([
  "animate",
  "circle",
  "defs",
  "desc",
  "ellipse",
  "filter",
  "g",
  "image",
  "line",
  "marker",
  "mask",
  "metadata",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "rect",
  "stop",
  "svg",
  "switch",
  "symbol",
  "text",
  "tspan",
  "use",
  "view",
]);

/**
 * Whether a tag renders an SVG element, which decides whether its geometry is
 * written as attributes or as style. Only a literal tag name can answer this:
 * a custom component is rendered by someone else and is assumed to be HTML,
 * which is also where motion draws the line.
 */
export function isSvgTag(tag: string | undefined): tag is string {
  return tag !== undefined && svgTags.has(tag);
}

/**
 * The name an SVG attribute is written under. Most are hyphenated
 * (`strokeDasharray` is the attribute `stroke-dasharray`), and the handful
 * that are genuinely camel case, `pathLength` and `viewBox` among them, are
 * the ones motion keeps in `camelCaseAttributes`.
 */
export function attributeName(key: string): string {
  return camelCaseAttributes.has(key) ? key : camelToDash(key);
}

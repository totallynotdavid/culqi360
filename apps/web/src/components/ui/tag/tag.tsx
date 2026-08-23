import { type JSX } from "@solidjs/web";

import styles from "./tag.module.css";

export type TagColor =
  | "blue"
  | "purple"
  | "turquoise"
  | "green"
  | "orange"
  | "red"
  | "yellow"
  | "pink"
  | "neutral";

type TagProps = {
  color: TagColor;
  text: string;
  weight?: "regular" | "medium";
  preventShrink?: boolean;
};

function tagVars(color: TagColor): JSX.CSSProperties {
  if (color === "neutral") {
    return {
      "--tag-background": "transparent",
      "--tag-text": "var(--foreground-secondary)",
    };
  }
  return {
    "--tag-background": `var(--color-${color}-5)`,
    "--tag-text": `var(--color-${color}-11)`,
  };
}

export function Tag(props: TagProps) {
  return (
    <span
      class={`${styles.tag} ${props.weight === "medium" ? styles.weightMedium : ""}`}
      style={tagVars(props.color)}
    >
      <span
        class={props.preventShrink ? styles.nonShrinkableText : styles.content}
      >
        {props.text}
      </span>
    </span>
  );
}

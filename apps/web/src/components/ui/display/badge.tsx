import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { merge, omit } from "solid-js";

import styles from "./badge.module.css";

const BADGE_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "destructive",
  "success",
  "warning",
  "info",
] as const;
type BadgeVariant = (typeof BADGE_VARIANTS)[number];

export interface BadgeProps {
  variant?: BadgeVariant;
  class?: string;
  children: JSX.Element;
}

function isBadgeVariant(value: string): value is BadgeVariant {
  return BADGE_VARIANTS.some((variant) => variant === value);
}

export function Badge(props: BadgeProps) {
  const merged = merge({ variant: "default" }, props);
  const others = omit(merged, "variant", "class", "children");

  const variantInput = merged.variant;
  const variant: BadgeVariant =
    variantInput && isBadgeVariant(variantInput) ? variantInput : "default";

  return (
    <div class={clsx(styles.badge, styles[variant], merged.class)} {...others}>
      {merged.children}
    </div>
  );
}

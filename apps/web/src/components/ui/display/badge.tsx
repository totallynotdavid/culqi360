import { clsx } from "clsx";
import { merge, splitProps } from "solid-js";
import { type JSX } from "@solidjs/web";

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
  const [local, others] = splitProps(merged, ["variant", "class", "children"]);

  const variantInput = local.variant;
  const variant: BadgeVariant =
    variantInput && isBadgeVariant(variantInput) ? variantInput : "default";

  return (
    <div class={clsx(styles.badge, styles[variant], local.class)} {...others}>
      {local.children}
    </div>
  );
}

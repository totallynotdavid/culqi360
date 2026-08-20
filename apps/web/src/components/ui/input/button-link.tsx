import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { merge, omit } from "solid-js";

import type { ButtonSize, ButtonVariant } from "./button";

import buttonStyles from "./button.module.css";

export interface ButtonLinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink(props: ButtonLinkProps) {
  const merged = merge({ variant: "primary", size: "md" }, props);
  const others = omit(merged, "variant", "size", "class", "href", "children");

  return (
    <a
      href={merged.href}
      class={clsx(
        buttonStyles.button,
        buttonStyles[merged.size],
        buttonStyles[merged.variant],
        merged.class,
      )}
      {...others}
    >
      {merged.children}
    </a>
  );
}

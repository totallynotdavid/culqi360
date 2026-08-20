import { type JSX } from "@solidjs/web";
import { splitProps } from "solid-js";

import styles from "./responsive-image.module.css";

export interface ImageSource {
  avif?: string;
  webp?: string;
  png?: string;
  jpg?: string;
  fallback: string;
}

export interface ResponsiveImageProps extends Omit<
  JSX.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> {
  sources: ImageSource;
  aspectRatio?: number;
}

/**
 * A maintainable responsive image component that supports multiple formats
 * via the <picture> element and helps prevent layout shifts.
 */
export function ResponsiveImage(props: ResponsiveImageProps) {
  const [local, others] = splitProps(props, [
    "sources",
    "aspectRatio",
    "class",
  ]);

  const containerStyle = () =>
    local.aspectRatio ? { "aspect-ratio": `${local.aspectRatio}` } : undefined;

  return (
    <picture
      class={`${styles.picture} ${local.class || ""}`.trim()}
      style={containerStyle()}
    >
      {local.sources.avif && (
        <source srcset={local.sources.avif} type="image/avif" />
      )}
      {local.sources.webp && (
        <source srcset={local.sources.webp} type="image/webp" />
      )}
      {local.sources.png && (
        <source srcset={local.sources.png} type="image/png" />
      )}
      {local.sources.jpg && (
        <source srcset={local.sources.jpg} type="image/jpeg" />
      )}
      <img
        alt={others.alt || ""}
        src={local.sources.fallback}
        loading="lazy"
        decoding="async"
        class={styles.image}
        {...others}
      />
    </picture>
  );
}

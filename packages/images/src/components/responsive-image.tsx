import { type JSX } from "@solidjs/web";
import { omit } from "solid-js";

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
  const others = omit(props, "sources", "aspectRatio", "class");

  const containerStyle = () =>
    props.aspectRatio ? { "aspect-ratio": `${props.aspectRatio}` } : undefined;

  return (
    <picture class={[styles.picture, props.class]} style={containerStyle()}>
      {props.sources.avif && (
        <source srcset={props.sources.avif} type="image/avif" />
      )}
      {props.sources.webp && (
        <source srcset={props.sources.webp} type="image/webp" />
      )}
      {props.sources.png && (
        <source srcset={props.sources.png} type="image/png" />
      )}
      {props.sources.jpg && (
        <source srcset={props.sources.jpg} type="image/jpeg" />
      )}
      <img
        alt={others.alt || ""}
        src={props.sources.fallback}
        loading="lazy"
        decoding="async"
        class={styles.image}
        {...others}
      />
    </picture>
  );
}

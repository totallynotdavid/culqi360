import { clsx } from "clsx";
import { Show, createSignal } from "solid-js";

import { avatarPlaceholderColors } from "./avatar-placeholder-color";

import styles from "./avatar.module.css";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarType = "squared" | "rounded";

interface AvatarProps {
  imageUrl: string | null;
  fallback: string;
  placeholderColorSeed?: string;
  size?: AvatarSize;
  type?: AvatarType;
  class?: string;
  imageClass?: string;
  fallbackClass?: string;
}

export function Avatar(props: AvatarProps) {
  // Remembering which URL failed rather than that one did means a new URL is a
  // fresh attempt without anything having to clear the flag.
  const [failedUrl, setFailedUrl] = createSignal<string | null>(null);

  const showImage = () =>
    Boolean(props.imageUrl) && failedUrl() !== props.imageUrl;

  const placeholderStyle = () => {
    if (props.placeholderColorSeed === undefined) {
      return undefined;
    }

    const { background, foreground } = avatarPlaceholderColors(
      props.placeholderColorSeed,
    );

    return {
      "--avatar-background": background,
      "--avatar-color": foreground,
    };
  };

  return (
    <span
      class={clsx(styles.root, props.size && styles[props.size], props.class)}
      data-type={props.type}
      aria-hidden="true"
    >
      <Show
        when={showImage()}
        fallback={
          <span
            class={clsx(styles.fallback, props.fallbackClass)}
            style={placeholderStyle()}
          >
            {props.fallback}
          </span>
        }
      >
        <img
          src={props.imageUrl ?? undefined}
          alt=""
          class={clsx(styles.image, props.imageClass)}
          onError={() => setFailedUrl(props.imageUrl)}
        />
      </Show>
    </span>
  );
}

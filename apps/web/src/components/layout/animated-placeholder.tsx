import { clsx } from "clsx";
import { createSignal, onSettled } from "solid-js";

import { SpringParallax } from "~/components/ui/animation/spring-parallax";

import styles from "./animated-placeholder.module.css";

const BG_LIGHT: Record<string, string> = {
  noFile: "/images/placeholders/background/no_file_bg.png",
  noNote: "/images/placeholders/background/no_note_bg.png",
  noTask: "/images/placeholders/background/no_task_bg.png",
  emptyTimeline: "/images/placeholders/background/empty_timeline_bg.png",
  error404: "/images/placeholders/background/404_bg.png",
  error500: "/images/placeholders/background/500_bg.png",
};

const BG_DARK: Record<string, string> = {
  noFile: "/images/placeholders/dark-background/no_file_bg.png",
  noNote: "/images/placeholders/dark-background/no_note_bg.png",
  noTask: "/images/placeholders/dark-background/no_task_bg.png",
  emptyTimeline: "/images/placeholders/dark-background/empty_timeline_bg.png",
  error404: "/images/placeholders/dark-background/404_bg.png",
  error500: "/images/placeholders/dark-background/500_bg.png",
};

const FG_LIGHT: Record<string, string> = {
  noFile: "/images/placeholders/moving-image/no_file.png",
  noNote: "/images/placeholders/moving-image/no_note.png",
  noTask: "/images/placeholders/moving-image/no_task.png",
  emptyTimeline: "/images/placeholders/moving-image/empty_timeline.png",
  error404: "/images/placeholders/moving-image/404.png",
  error500: "/images/placeholders/moving-image/500.png",
};

const FG_DARK: Record<string, string> = {
  noFile: "/images/placeholders/dark-moving-image/no_file.png",
  noNote: "/images/placeholders/dark-moving-image/no_note.png",
  noTask: "/images/placeholders/dark-moving-image/no_task.png",
  emptyTimeline: "/images/placeholders/dark-moving-image/empty_timeline.png",
  error404: "/images/placeholders/dark-moving-image/404.png",
  error500: "/images/placeholders/dark-moving-image/500.png",
};

export type AnimatedPlaceholderType = keyof typeof BG_LIGHT;

interface AnimatedPlaceholderProps {
  type: AnimatedPlaceholderType;
}

// Dark-mode images follow the app-managed `data-theme` attribute rather than
// `prefers-color-scheme`.
export function AnimatedPlaceholder(props: AnimatedPlaceholderProps) {
  const isError = () => props.type === "error404" || props.type === "error500";

  const [isDark, setIsDark] = createSignal(false);

  onSettled(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.getAttribute("data-theme") === "dark");
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  });

  const bg = () => (isDark() ? BG_DARK : BG_LIGHT)[props.type];
  const fg = () => (isDark() ? FG_DARK : FG_LIGHT)[props.type];

  return (
    <div class={styles.container}>
      <img
        src={bg()}
        alt=""
        class={clsx(styles.bg, isError() && styles.error)}
        aria-hidden="true"
      />

      <SpringParallax class={styles.parallaxLayer}>
        <div class={styles.fgWrapper}>
          <img
            src={fg()}
            alt=""
            class={clsx(styles.fg, isError() && styles.error)}
            aria-hidden="true"
          />
        </div>
      </SpringParallax>
    </div>
  );
}

import type { RouteSectionProps } from "@solidjs/router";
import { For, createSignal, onSettled } from "solid-js";

import { ThemeToggle } from "~/components/ui/theme/theme-toggle";
import { PUBLIC_MENU_ITEMS } from "~/features/public/menu/data";
import { PLATFORM_NAME } from "~/shared/branding";

import styles from "./(public).module.css";

export default function PublicLayout(props: RouteSectionProps) {
  const [hasScrolled, setHasScrolled] = createSignal(false);

  onSettled(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  });

  return (
    <main class={styles.main}>
      <header class={[styles.header, hasScrolled() && styles.elevated]}>
        <div class={styles.headerContainer}>
          <div class={styles.navSurface}>
            <a href="/" class={styles.logo}>
              {PLATFORM_NAME}
            </a>
            <nav class={styles.nav} aria-label="Público">
              <For each={PUBLIC_MENU_ITEMS}>
                {(item) => (
                  <a href={item.href} class={styles.navLink}>
                    {item.label}
                  </a>
                )}
              </For>
            </nav>
            <div class={styles.rightControls}>
              <a href="/" class={styles.ctaGhost}>
                Inicio
              </a>
              <a href="/login" class={styles.ctaPrimary}>
                Iniciar sesión
              </a>
              <ThemeToggle class={styles.themeToggle} />
            </div>
          </div>
        </div>
      </header>
      {props.children}
    </main>
  );
}

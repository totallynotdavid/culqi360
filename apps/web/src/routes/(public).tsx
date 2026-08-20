import { A } from "@solidjs/router";
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
      <header
        classList={{ [styles.header]: true, [styles.elevated]: hasScrolled() }}
      >
        <div class={styles.headerContainer}>
          <div class={styles.navSurface}>
            <A href="/" class={styles.logo}>
              {PLATFORM_NAME}
            </A>
            <nav class={styles.nav} aria-label="Público">
              <For each={PUBLIC_MENU_ITEMS}>
                {(item) => (
                  <A href={item.href} class={styles.navLink}>
                    {item.label}
                  </A>
                )}
              </For>
            </nav>
            <div class={styles.rightControls}>
              <A href="/" class={styles.ctaGhost}>
                Inicio
              </A>
              <A href="/login" class={styles.ctaPrimary}>
                Iniciar sesión
              </A>
              <ThemeToggle class={styles.themeToggle} />
            </div>
          </div>
        </div>
      </header>
      {props.children}
    </main>
  );
}

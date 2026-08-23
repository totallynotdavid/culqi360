import { clsx } from "clsx";
import { For, Show } from "solid-js";

import Check from "~/components/icons/check";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Input } from "~/components/ui/input/input";
import { useTheme } from "~/components/ui/theme/theme-context";
import type { ThemeMode } from "~/components/ui/theme/theme-mode";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";

import styles from "./settings-page.module.css";

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsPageLayout>
      <SettingsSection
        title="Tema"
        description="Elige cómo se ve la aplicación. El cambio se aplica al instante."
      >
        <div class={styles.themeGrid}>
          <For each={THEME_OPTIONS}>
            {(option) => {
              const selected = () => theme() === option.value;

              return (
                <button
                  type="button"
                  class={clsx(
                    styles.themeCard,
                    selected() && styles.themeCardActive,
                  )}
                  aria-pressed={selected() ? "true" : "false"}
                  onClick={() => setTheme(option.value)}
                >
                  <span
                    class={styles.themePreview}
                    data-variant={option.value}
                    aria-hidden="true"
                  >
                    <span class={styles.themeBar} data-tone="strong" />
                    <span class={styles.themeBar} data-tone="soft" />
                    <span class={styles.themeBar} data-tone="soft" />
                  </span>

                  <span class={styles.themeCardLabel}>
                    {option.label}

                    <Show when={selected()}>
                      <Check size={16} class={styles.themeCardCheck} />
                    </Show>
                  </span>
                </button>
              );
            }}
          </For>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Idioma y región"
        description="Elige el idioma de la aplicación."
      >
        <div class={styles.stack}>
          <div class={styles.formGrid}>
            <Input label="Idioma" value="Español (Perú)" disabled />
          </div>

          <p class={styles.helperText}>
            La aplicación está disponible en español (Perú).
          </p>
        </div>
      </SettingsSection>
    </SettingsPageLayout>
  );
}

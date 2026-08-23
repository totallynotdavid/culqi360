import { ResponsiveImage } from "@crm/images";
import { type JSX } from "@solidjs/web";
import { Show } from "solid-js";

import { PLATFORM_NAME } from "~/shared/branding";
import { PLATFORM_LOGO } from "~/shared/branding-logo";

import styles from "./onboarding-shell.module.css";

interface OnboardingShellProps {
  onBack?: () => void;
  centered?: boolean;
  children: JSX.Element;
}

export function OnboardingShell(props: OnboardingShellProps) {
  return (
    <div class={styles.background}>
      <header class={styles.header}>
        <div class={styles.headerLeft}>
          <Show when={props.onBack}>
            {(onBack) => (
              <button
                type="button"
                class={styles.backButton}
                aria-label="Volver"
                onClick={() => onBack()()}
              >
                <ChevronLeftIcon />
              </button>
            )}
          </Show>
        </div>
        <div class={styles.headerCenter}>
          <ResponsiveImage
            sources={PLATFORM_LOGO}
            alt={PLATFORM_NAME}
            width="24"
            height="24"
            class={styles.headerLogo}
          />
        </div>
        <div class={styles.headerRight} />
      </header>

      <div class={[styles.stepPage, props.centered && styles.stepPageCentered]}>
        {props.children}
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M15 6l-6 6l6 6" />
    </svg>
  );
}

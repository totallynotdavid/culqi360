"use client";

import { ResponsiveImage } from "@crm/images";
import { type JSX } from "@solidjs/web";
import { Show } from "solid-js";

import { PLATFORM_NAME } from "~/shared/branding";
import { PLATFORM_LOGO } from "~/shared/branding-logo";

import styles from "./auth-flow-shell.module.css";

interface AuthFlowShellProps {
  title: string;
  description?: string;
  topBar?: JSX.Element;
  footer?: JSX.Element;
  children: JSX.Element;
}

export function AuthFlowShell(props: AuthFlowShellProps) {
  return (
    <div class={styles.shell}>
      <section class={styles.surface}>
        <div class={styles.content}>
          <Show when={props.topBar}>
            <div class={styles.topBar}>{props.topBar}</div>
          </Show>

          <div class={styles.logo}>
            <ResponsiveImage
              sources={PLATFORM_LOGO}
              alt={PLATFORM_NAME}
              width="40"
              height="40"
              class={styles.logoImage}
            />
          </div>

          <h1 class={styles.title}>{props.title}</h1>

          <Show when={props.description}>
            <p class={styles.description}>{props.description}</p>
          </Show>

          <div class={styles.body}>{props.children}</div>

          <Show when={props.footer}>
            <footer class={styles.footer}>{props.footer}</footer>
          </Show>
        </div>
      </section>
    </div>
  );
}

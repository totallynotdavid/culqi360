import type { JSX } from "@solidjs/web";
import { children, Match, Show, Switch } from "solid-js";

import {
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardHeaderActions,
  WidgetCardTitle,
  type WidgetCardVariant,
} from "./widget-card";

import styles from "./widget-card-shell.module.css";

export type WidgetStatus =
  | "ready"
  | "loading"
  | "empty"
  | "error"
  | "forbidden";

export function WidgetCardShell(props: {
  title: string;
  count?: number;
  action?: JSX.Element;
  status?: WidgetStatus;
  emptyLabel?: string;
  variant?: WidgetCardVariant;
  children: JSX.Element;
}) {
  const status = () => props.status ?? "ready";
  const action = children(() => props.action);

  return (
    <WidgetCard variant={props.variant ?? "dashboard"}>
      <WidgetCardHeader>
        <WidgetCardTitle text={props.title} count={props.count} />
        <Show when={action()}>
          <WidgetCardHeaderActions>{action()}</WidgetCardHeaderActions>
        </Show>
      </WidgetCardHeader>
      <WidgetCardContent>
        <Switch fallback={props.children}>
          <Match when={status() === "loading"}>
            <p class={styles.state}>Cargando…</p>
          </Match>
          <Match when={status() === "empty"}>
            <p class={styles.state}>
              {props.emptyLabel ?? "Aún no hay datos."}
            </p>
          </Match>
          <Match when={status() === "error"}>
            <p class={styles.stateError}>No se pudo cargar el widget.</p>
          </Match>
          <Match when={status() === "forbidden"}>
            <p class={styles.state}>Sin acceso a este widget.</p>
          </Match>
        </Switch>
      </WidgetCardContent>
    </WidgetCard>
  );
}

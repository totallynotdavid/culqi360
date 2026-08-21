import type { ExecutiveStateSnapshot } from "@crm/contracts/extension";
import { Show } from "solid-js";
import type { Accessor } from "solid-js";

import { TopBarActionButton } from "~/components/layout/top-bar-action-button";
import { TopBarTooltip } from "~/components/layout/top-bar-tooltip";

import styles from "./extension-status-indicator.module.css";

interface ExtensionStatusIndicatorProps {
  extensionState: Accessor<ExecutiveStateSnapshot | null>;
  extensionErrorMessage: Accessor<string | null>;
  onOpen: () => void;
}

type ExtensionStatusView = {
  color: "ok" | "pending" | "warning" | "error" | "offline";
  label: string;
  tooltip: string;
};

export function ExtensionStatusIndicator(props: ExtensionStatusIndicatorProps) {
  const status = (): ExtensionStatusView => {
    const errorMessage = props.extensionErrorMessage();
    if (errorMessage) {
      return {
        color: "error",
        label: "Revisar extensión",
        tooltip: errorMessage,
      };
    }

    const state = props.extensionState();
    if (!state) {
      return {
        color: "offline",
        label: "Desconectado",
        tooltip: "Estado de la extensión: Desconectado",
      };
    }

    if (state.syncHealth === "reauth_required") {
      return {
        color: "warning",
        label: "Reconectar",
        tooltip: "La extensión requiere volver a autenticarse.",
      };
    }

    if (state.syncHealth === "error") {
      return {
        color: "error",
        label: "No se pudo sincronizar",
        tooltip: "La extensión reportó un error de sincronización.",
      };
    }

    if (state.syncHealth === "pending") {
      return {
        color: "pending",
        label: "Sincronizando...",
        tooltip: "Estado de la extensión: Sincronizando...",
      };
    }

    return {
      color: "ok",
      label: "Conectado",
      tooltip: "Estado de la extensión: Conectado",
    };
  };

  return (
    <TopBarTooltip content={status().tooltip}>
      <TopBarActionButton
        ariaLabel={`Estado de la extensión: ${status().label}`}
        label={status().label}
        onClick={props.onOpen}
        class={styles.root}
        buttonClass={styles.trigger}
      >
        <span class={`${styles.dot} ${styles[status().color]}`} />
        <Show when={props.extensionState()?.assignmentId}>
          <span class={styles.badge}>
            {props.extensionState()?.assignmentId}
          </span>
        </Show>
      </TopBarActionButton>
    </TopBarTooltip>
  );
}

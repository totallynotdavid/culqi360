import { useAction } from "@solidjs/router";
import { createSignal, Show } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import { actionErrorMessage } from "~/contracts/errors";
import type { MemberDetail } from "~/contracts/members";
import { appCalendarDateAt } from "~/domain/time/app-time";
import { generateMemberResetLinkMutation } from "~/features/team-management/data/member-mutations";
import { memberLoginBlock } from "~/features/team-management/member-login-block";

import styles from "./team-management.module.css";

export function MemberResetLink(props: { detail: MemberDetail }) {
  const generateResetLink = useAction(generateMemberResetLinkMutation);
  const { enqueueErrorSnackBar } = useSnackBar();

  const [busy, setBusy] = createSignal(false);
  const [resetLink, setResetLink] = createSignal<string | null>(null);
  const [copyState, setCopyState] = createSignal<"idle" | "copied" | "manual">(
    "idle",
  );

  let linkInput: HTMLInputElement | undefined;
  let copyResetTimer: number | undefined;

  const loginBlockWarning = () => {
    const block = memberLoginBlock(props.detail, appCalendarDateAt(Date.now()));
    if (block === "expired") {
      return props.detail.isActive
        ? "Esta cuenta está vencida: el enlace no le permitirá iniciar sesión. Cambia la Fecha de vencimiento en Vencimiento de la cuenta antes de compartirlo."
        : "Esta cuenta está vencida: el enlace no le permitirá iniciar sesión. Cambia la Fecha de vencimiento en Vencimiento de la cuenta y luego usa Reactivar antes de compartirlo.";
    }
    if (block === "inactive") {
      return "Esta cuenta está desactivada: el enlace no le permitirá iniciar sesión. Usa el botón Reactivar antes de compartirlo.";
    }
    return null;
  };

  // Clipboard writes outside a user gesture can be denied; in that case the
  // field keeps the link selected so the admin can copy it by hand.
  async function copyResetLink(url: string) {
    if (!url) {
      return;
    }
    window.clearTimeout(copyResetTimer);
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      copyResetTimer = window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      linkInput?.select();
      setCopyState("manual");
    }
  }

  async function runGenerateResetLink() {
    setBusy(true);
    try {
      const { resetUrl } = await generateResetLink(props.detail.id);
      setResetLink(resetUrl);
      setCopyState("idle");
      await copyResetLink(resetUrl);
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={props.detail.canManage}>
      <SettingsSection
        title="Contraseña"
        description="Genera un enlace para que este usuario cree una nueva contraseña."
      >
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy()}
            onClick={() => void runGenerateResetLink()}
          >
            Generar enlace
          </Button>
        </div>

        <Show when={busy() || resetLink() !== null}>
          <div class={styles.resetLinkPanel}>
            <Show when={busy()}>
              <span class={styles.resetLinkHint}>Generando enlace…</span>
            </Show>
            <Show when={resetLink()}>
              {(link) => (
                <>
                  <Input
                    ref={(el) => (linkInput = el)}
                    label="Enlace de restablecimiento"
                    value={link()}
                    readonly
                  />
                  <div class={styles.resetLinkRow}>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void copyResetLink(link())}
                    >
                      {copyState() === "copied" ? "Copiado" : "Copiar enlace"}
                    </Button>
                    <span class={styles.resetLinkHint}>
                      Válido por 1 hora y de un solo uso. No se volverá a
                      mostrar.
                    </span>
                  </div>
                  <Show when={copyState() === "manual"}>
                    <p class={styles.resetLinkNote}>
                      Copia el enlace manualmente
                    </p>
                  </Show>
                  <Show when={loginBlockWarning()}>
                    {(warning) => (
                      <p class={styles.resetLinkWarning}>{warning()}</p>
                    )}
                  </Show>
                </>
              )}
            </Show>
          </div>
        </Show>
      </SettingsSection>
    </Show>
  );
}

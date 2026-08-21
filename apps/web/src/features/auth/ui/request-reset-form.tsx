import { useSubmissions } from "@solidjs/router";
import { Show } from "solid-js";

import { EnterTransition } from "~/components/ui/animation/enter-transition";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import { actionErrorMessage } from "~/contracts/errors";
import { requestPasswordResetMutation } from "~/features/auth/data/mutations";
import { AuthFlowShell } from "~/features/auth/ui/auth-flow-shell";
import { LegalFooter } from "~/features/auth/ui/legal-footer";
import { LoginFeedback } from "~/features/auth/ui/login-feedback";

import shellStyles from "~/features/auth/ui/auth-flow-shell.module.css";
import linkStyles from "~/features/auth/ui/auth-links.module.css";
import styles from "~/features/auth/ui/auth-shell.module.css";
import pageStyles from "~/features/auth/ui/login-page.module.css";

export function RequestResetForm() {
  const submissions = useSubmissions(requestPasswordResetMutation);
  const latest = () => submissions.at(-1);
  const requestSent = () => latest()?.result?.ok === true;
  const errorMessage = () => {
    const error = latest()?.error;
    return error ? actionErrorMessage(error) : undefined;
  };

  return (
    <AuthFlowShell
      title="¿Olvidaste tu contraseña?"
      description="Ingresa tu correo y te enviaremos un enlace para restablecerla."
    >
      <Show when={!requestSent()} fallback={<ResetLinkSentNotice />}>
        <EnterTransition>
          <div class={pageStyles.formStack}>
            <form
              action={requestPasswordResetMutation}
              method="post"
              class={pageStyles.formStack}
            >
              <Input
                name="email"
                type="email"
                placeholder="Correo electrónico"
                autocomplete="email"
                required
              />

              <LoginFeedback message={errorMessage()} />

              <Button type="submit" class={styles.full}>
                Enviar enlace
              </Button>

              <a href="/login" class={linkStyles.passkeyLink}>
                Volver al inicio de sesión
              </a>
            </form>

            <div class={shellStyles.footerNote}>
              <LegalFooter />
            </div>
          </div>
        </EnterTransition>
      </Show>
    </AuthFlowShell>
  );
}

function ResetLinkSentNotice() {
  return (
    <EnterTransition>
      <div class={pageStyles.formStack}>
        <p class={pageStyles.supportText}>
          Si existe una cuenta con ese correo, recibirás un enlace en los
          próximos minutos.
        </p>

        <a href="/login" class={linkStyles.passkeyLink}>
          Volver al inicio de sesión
        </a>
      </div>
    </EnterTransition>
  );
}

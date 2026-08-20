import { useSubmissions } from "@solidjs/router";
import { Show } from "solid-js";

import { EnterTransition } from "~/components/ui/animation/enter-transition";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import { codeIs } from "~/contracts/error-codes";
import { parseWireError } from "~/contracts/errors";
import { resetPasswordMutation } from "~/features/auth/data/mutations";
import { AuthFlowShell } from "~/features/auth/ui/auth-flow-shell";
import { LegalFooter } from "~/features/auth/ui/legal-footer";
import { LoginFeedback } from "~/features/auth/ui/login-feedback";

import shellStyles from "~/features/auth/ui/auth-flow-shell.module.css";
import linkStyles from "~/features/auth/ui/auth-links.module.css";
import styles from "~/features/auth/ui/auth-shell.module.css";
import pageStyles from "~/features/auth/ui/login-page.module.css";

export function SetNewPasswordForm(props: { token: string }) {
  const submissions = useSubmissions(resetPasswordMutation);
  const latest = () => submissions.at(-1);
  const succeeded = () => latest()?.result?.ok === true;

  const submitError = () => {
    const error = latest()?.error;
    return error ? parseWireError(error) : undefined;
  };

  const tokenExpiredMessage = () => {
    const submitFailure = submitError();
    return submitFailure !== undefined && codeIs(submitFailure, "invalid_token")
      ? submitFailure.message
      : undefined;
  };

  const fieldError = () => {
    const submitFailure = submitError();
    if (submitFailure === undefined || codeIs(submitFailure, "invalid_token")) {
      return undefined;
    }
    return submitFailure.message;
  };

  return (
    <AuthFlowShell
      title="Nueva contraseña"
      description="Elige una contraseña segura para tu cuenta."
    >
      <Show when={!succeeded()} fallback={<PasswordResetDoneNotice />}>
        {/* An invalid token requires a new link, not another form submission. */}
        <Show
          when={tokenExpiredMessage()}
          fallback={
            <EnterTransition>
              <div class={pageStyles.formStack}>
                <form
                  action={resetPasswordMutation}
                  method="post"
                  class={pageStyles.formStack}
                >
                  <input type="hidden" name="token" value={props.token} />
                  <Input
                    name="password"
                    type="password"
                    placeholder="Nueva contraseña"
                    autocomplete="new-password"
                    required
                  />
                  <Input
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirmar contraseña"
                    autocomplete="new-password"
                    required
                  />
                  <LoginFeedback message={fieldError()} />
                  <Button type="submit" class={styles.full}>
                    Cambiar contraseña
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
          }
        >
          {(message) => <ExpiredLinkNotice message={message()} />}
        </Show>
      </Show>
    </AuthFlowShell>
  );
}

function PasswordResetDoneNotice() {
  return (
    <EnterTransition>
      <div class={pageStyles.formStack}>
        <p class={pageStyles.supportText}>
          Tu contraseña fue actualizada. Ya puedes iniciar sesión con tu nueva
          contraseña.
        </p>
        <a href="/login" class={linkStyles.passkeyLink}>
          Ir al inicio de sesión
        </a>
      </div>
    </EnterTransition>
  );
}

function ExpiredLinkNotice(props: { message: string }) {
  return (
    <EnterTransition>
      <div class={pageStyles.formStack}>
        <p class={pageStyles.supportText}>{props.message}</p>
        <a href="/reset-password" class={linkStyles.passkeyLink}>
          Solicitar un enlace nuevo
        </a>
      </div>
    </EnterTransition>
  );
}

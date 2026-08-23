import { useSearchParams, useSubmissions } from "@solidjs/router";
import { createMemo, createSignal, Show, Loading } from "solid-js";

import { Loader } from "~/components/feedback/spinner/loader";
import { EnterTransition } from "~/components/ui/animation/enter-transition";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import { codeIs } from "~/contracts/error-codes";
import { parseWireError } from "~/contracts/errors";
import { parseLoginFlowId } from "~/domain/auth/login-flow/parse-id";
import { recoveryLoginMutation } from "~/features/auth/data/mutations";
import { AuthFlowShell } from "~/features/auth/ui/auth-flow-shell";
import { LegalFooter } from "~/features/auth/ui/legal-footer";
import { loginFlowQuery } from "~/rpc/auth/login-flow";

import shellStyles from "~/features/auth/ui/auth-flow-shell.module.css";
import linkStyles from "~/features/auth/ui/auth-links.module.css";
import styles from "~/features/auth/ui/auth-shell.module.css";
import pageStyles from "~/features/auth/ui/login-page.module.css";

export default function LoginRecoveryPage() {
  const [searchParams] = useSearchParams();
  const recoverySubmissions = useSubmissions(recoveryLoginMutation);
  const [recoveryCode, setRecoveryCode] = createSignal("");
  const flowId = () => parseLoginFlowId(searchParams.flow);
  const loginFlow = createMemo(() => {
    const currentFlowId = flowId();
    return currentFlowId
      ? loginFlowQuery(currentFlowId)
      : Promise.resolve(null);
  });
  const submitError = () => {
    const error = recoverySubmissions.at(-1)?.error;
    return error ? parseWireError(error) : undefined;
  };

  const flowExpiredAtSubmit = () => {
    const submitFailure = submitError();
    return submitFailure !== undefined && codeIs(submitFailure, "flow_expired");
  };

  // Allow TOTP and identified-passkey flows only; a discoverable passkey flow
  // has no user for recovery-code redemption.
  const recoveryFlow = createMemo(() => {
    const flow = loginFlow();
    if (flowExpiredAtSubmit()) {
      return null;
    }
    if (!flow) {
      return null;
    }
    if (flow.state === "totp") {
      return flow;
    }
    if (flow.state === "passkey" && flow.mode === "identified") {
      return flow;
    }
    return null;
  });

  const recoveryError = () => {
    const submitFailure = submitError();
    if (submitFailure === undefined || codeIs(submitFailure, "flow_expired")) {
      return undefined;
    }
    return submitFailure.message;
  };

  return (
    <AuthFlowShell
      title="Código de recuperación"
      description="Ingresa uno de los códigos que guardaste al configurar tu seguridad."
    >
      <div class={pageStyles.formStack}>
        <Loading
          fallback={
            <output class={pageStyles.loadingStack} aria-live="polite">
              <p class={pageStyles.loadingLabel}>Cargando recuperación</p>
              <Loader />
            </output>
          }
        >
          <Show
            when={recoveryFlow()}
            fallback={
              <form
                class={pageStyles.formStack}
                aria-label="expired-login-flow"
              >
                <p class={pageStyles.formError} role="alert">
                  La sesión de verificación expiró. Intenta de nuevo.
                </p>
                <a href="/login" class={linkStyles.passkeyLink}>
                  Volver al inicio de sesión
                </a>
              </form>
            }
          >
            {(flow) => (
              <EnterTransition>
                <form
                  class={pageStyles.formStack}
                  action={recoveryLoginMutation}
                  method="post"
                >
                  <input type="hidden" name="flowId" value={flow().id} />
                  <Input
                    id="recovery-code"
                    type="text"
                    name="recoveryCode"
                    placeholder="Código de recuperación"
                    autocomplete="one-time-code"
                    autocapitalize="characters"
                    autocorrect="off"
                    spellcheck={false}
                    value={recoveryCode()}
                    onInput={(event) =>
                      setRecoveryCode(event.currentTarget.value)
                    }
                    required
                  />
                  <Show when={recoveryError()}>
                    {(msg) => (
                      <p class={pageStyles.formError} role="alert">
                        {msg()}
                      </p>
                    )}
                  </Show>
                  <p class={pageStyles.supportText}>
                    Usuario: {flow().identifier}
                  </p>
                  <div class={pageStyles.actionRow}>
                    <a href="/login" class={linkStyles.passkeyLink}>
                      Usar otra cuenta
                    </a>
                    <Button type="submit" class={styles.full}>
                      Iniciar sesión
                    </Button>
                  </div>
                </form>
              </EnterTransition>
            )}
          </Show>
        </Loading>
        <div class={shellStyles.footerNote}>
          <LegalFooter />
        </div>
      </div>
    </AuthFlowShell>
  );
}

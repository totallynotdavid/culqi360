import { useSearchParams, useSubmissions } from "@solidjs/router";
import { createMemo, createSignal, Show, Loading } from "solid-js";

import { Loader } from "~/components/feedback/spinner/loader";
import { EnterTransition } from "~/components/ui/animation/enter-transition";
import { Button } from "~/components/ui/input/button";
import { codeIs } from "~/contracts/error-codes";
import { parseWireError } from "~/contracts/errors";
import { parseLoginFlowId } from "~/domain/auth/login-flow/parse-id";
import { totpLoginMutation } from "~/features/auth/data/mutations";
import { useAuthPageView } from "~/features/auth/services/use-auth-analytics";
import { AuthFlowShell } from "~/features/auth/ui/auth-flow-shell";
import { LegalFooter } from "~/features/auth/ui/legal-footer";
import { OtpSlotInput } from "~/features/auth/ui/otp-slot-input";
import { loginFlowQuery } from "~/rpc/auth/login-flow";

import shellStyles from "~/features/auth/ui/auth-flow-shell.module.css";
import linkStyles from "~/features/auth/ui/auth-links.module.css";
import styles from "~/features/auth/ui/auth-shell.module.css";
import pageStyles from "~/features/auth/ui/login-page.module.css";

export default function LoginVerifyPage() {
  useAuthPageView("login_verify");
  const [searchParams] = useSearchParams();
  const totpSubmissions = useSubmissions(totpLoginMutation);
  const [totpCode, setTotpCode] = createSignal("");
  const flowId = () => parseLoginFlowId(searchParams.flow);
  const loginFlow = createMemo(() => {
    const currentFlowId = flowId();
    return currentFlowId
      ? loginFlowQuery(currentFlowId)
      : Promise.resolve(null);
  });
  const submitError = () => {
    const error = totpSubmissions.at(-1)?.error;
    return error ? parseWireError(error) : undefined;
  };

  const flowExpiredAtSubmit = () => {
    const submitFailure = submitError();
    return submitFailure !== undefined && codeIs(submitFailure, "flow_expired");
  };

  const totpFlow = createMemo(() => {
    const flow = loginFlow();
    if (flowExpiredAtSubmit()) {
      return null;
    }
    return flow?.state === "totp" ? flow : null;
  });

  const totpError = () => {
    const submitFailure = submitError();
    if (submitFailure === undefined || codeIs(submitFailure, "flow_expired")) {
      return undefined;
    }
    return submitFailure.message;
  };

  return (
    <AuthFlowShell
      title="Verificar código"
      description="Ingresa el código de 6 dígitos de tu app de autenticación."
    >
      <div class={pageStyles.formStack}>
        <Loading
          fallback={
            <output class={pageStyles.loadingStack} aria-live="polite">
              <p class={pageStyles.loadingLabel}>Cargando verificación</p>
              <Loader />
            </output>
          }
        >
          <Show
            when={totpFlow()}
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
                  action={totpLoginMutation}
                  method="post"
                >
                  <input type="hidden" name="flowId" value={flow().id} />
                  <input type="hidden" name="totpCode" value={totpCode()} />
                  <OtpSlotInput
                    value={totpCode()}
                    onValueChange={setTotpCode}
                  />
                  <Show when={totpError()}>
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
                  <a
                    href={`/login/recovery?flow=${flow().id}`}
                    class={linkStyles.helpLink}
                  >
                    Usar un código de recuperación
                  </a>
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

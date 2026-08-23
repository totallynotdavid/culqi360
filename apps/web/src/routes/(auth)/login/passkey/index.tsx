import { useSearchParams } from "@solidjs/router";
import { createMemo, Show, Loading } from "solid-js";

import { Loader } from "~/components/feedback/spinner/loader";
import { EnterTransition } from "~/components/ui/animation/enter-transition";
import { Button } from "~/components/ui/input/button";
import { parseLoginFlowId } from "~/domain/auth/login-flow/parse-id";
import { useAuthPageView } from "~/features/auth/services/use-auth-analytics";
import { usePasskeyLogin } from "~/features/auth/services/use-passkey-login";
import { AuthFlowShell } from "~/features/auth/ui/auth-flow-shell";
import { loginFlowQuery } from "~/rpc/auth/login-flow";

import shellStyles from "~/features/auth/ui/auth-flow-shell.module.css";
import linkStyles from "~/features/auth/ui/auth-links.module.css";
import styles from "~/features/auth/ui/auth-shell.module.css";
import pageStyles from "~/features/auth/ui/login-page.module.css";

export default function LoginPasskeyPage() {
  useAuthPageView("login_passkey");
  const [searchParams] = useSearchParams();
  const passkeyLogin = usePasskeyLogin();
  const flowId = () => parseLoginFlowId(searchParams.flow);
  const loginFlow = createMemo(() => {
    const currentFlowId = flowId();
    return currentFlowId
      ? loginFlowQuery(currentFlowId)
      : Promise.resolve(null);
  });
  const passkeyFlow = createMemo(() => {
    const flow = loginFlow();
    if (flow === undefined && flowId()) {
      return undefined;
    }
    return flow?.state === "passkey" && flow.mode === "identified"
      ? flow
      : null;
  });

  return (
    <AuthFlowShell
      title="Verificar clave de acceso"
      description="Retoma el acceso con la clave asociada a tu cuenta."
    >
      <Loading
        fallback={
          <output class={pageStyles.loadingStack} aria-live="polite">
            <p class={pageStyles.loadingLabel}>Cargando clave de acceso</p>
            <Loader />
          </output>
        }
      >
        <Show
          when={passkeyFlow()}
          fallback={
            <div class={pageStyles.formStack}>
              <p class={pageStyles.formError} role="alert">
                La sesión de clave de acceso expiró. Intenta de nuevo.
              </p>
              <a href="/login" class={linkStyles.passkeyLink}>
                Volver al inicio de sesión
              </a>
            </div>
          }
        >
          {(flow) => (
            <EnterTransition>
              <div class={pageStyles.formStack}>
                <p class={pageStyles.supportText}>
                  Usuario: {flow().identifier}
                </p>
                <Show when={passkeyLogin.errorMessage()}>
                  {(message) => (
                    <p class={pageStyles.formError} role="alert">
                      {message()}
                    </p>
                  )}
                </Show>
                <Show when={passkeyLogin.busy()}>
                  <output class={shellStyles.loadingBlock} aria-live="polite">
                    <p class={shellStyles.loadingLabel}>
                      Esperando tu clave de acceso
                    </p>
                    <Loader />
                  </output>
                </Show>
                <Show when={!passkeyLogin.supportKnown()}>
                  <output class={shellStyles.loadingBlock} aria-live="polite">
                    <p class={shellStyles.loadingLabel}>
                      Comprobando compatibilidad del navegador
                    </p>
                    <Loader />
                  </output>
                </Show>
                <Show
                  when={passkeyLogin.supportKnown() && passkeyLogin.supported()}
                  fallback={
                    <Show when={passkeyLogin.supportKnown()}>
                      <p class={pageStyles.formError} role="alert">
                        Este navegador no admite claves de acceso.
                      </p>
                    </Show>
                  }
                >
                  <Button
                    type="button"
                    class={styles.full}
                    loading={passkeyLogin.busy()}
                    onClick={() => {
                      void passkeyLogin.continueFlow(flow());
                    }}
                  >
                    Reintentar con clave de acceso
                  </Button>
                </Show>
                <a
                  href={`/login/recovery?flow=${flow().id}`}
                  class={linkStyles.helpLink}
                >
                  Usar un código de recuperación
                </a>
              </div>
            </EnterTransition>
          )}
        </Show>
      </Loading>
      <a href="/login" class={linkStyles.helpLink}>
        Volver al inicio de sesión
      </a>
    </AuthFlowShell>
  );
}

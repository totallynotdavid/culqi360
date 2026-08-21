import { useSubmissions } from "@solidjs/router";
import { createSignal, onSettled, Show } from "solid-js";

import Google from "~/components/icons/brands/google";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import { actionErrorMessage } from "~/contracts/errors";
import { passwordLoginMutation } from "~/features/auth/data/mutations";
import { useLoginFlow } from "~/features/auth/services/use-login-flow";
import { usePasskeyLogin } from "~/features/auth/services/use-passkey-login";

import { LastUsedPill } from "./last-used-pill";
import { LegalFooter } from "./legal-footer";
import { LoginFeedback } from "./login-feedback";

import linkStyles from "./auth-links.module.css";
import fullStyles from "./auth-shell.module.css";
import pageStyles from "./login-page.module.css";

export function LoginHome() {
  const loginMethods = useLoginFlow();
  const passwordSubmissions = useSubmissions(passwordLoginMutation);
  const passkeyLogin = usePasskeyLogin();

  const [username, setUsername] = createSignal("");

  let usernameInputRef: HTMLInputElement | undefined;

  onSettled(() => {
    usernameInputRef?.focus();
  });

  // Password login hands back a passkey flow when the account requires a
  // step-up factor; continue it here instead of navigating away. onSettled
  // runs once per submission, so unlike an effect over the result there is no
  // repeat delivery to dedupe.
  passwordLoginMutation.onSettled((submission) => {
    if (submission.result) {
      void passkeyLogin.continueFlow(submission.result.flow);
    }
  });

  const passwordError = () => {
    const error = passwordSubmissions.at(-1)?.error;
    return error ? actionErrorMessage(error) : undefined;
  };

  function handleUsernameInput(value: string) {
    setUsername(value);
    passkeyLogin.clear();
  }

  return (
    <div class={pageStyles.formStack}>
      <div class={pageStyles.ssoButtonContainer}>
        <Button
          variant="secondary"
          class={fullStyles.full}
          onClick={() => {
            loginMethods.markUsed("google");
            window.location.href = "/api/auth/google";
          }}
        >
          <Google size={16} />
          Continuar con Google
        </Button>
        <Show when={loginMethods.lastUsedMethod() === "google"}>
          <LastUsedPill />
        </Show>
      </div>

      <div class={pageStyles.ssoButtonContainer}>
        <Button
          variant="secondary"
          class={fullStyles.full}
          loading={passkeyLogin.busy()}
          onClick={() => {
            loginMethods.markUsed("passkey");
            void passkeyLogin.startDiscoverable();
          }}
        >
          Entrar con llave de acceso
        </Button>
        <Show when={loginMethods.lastUsedMethod() === "passkey"}>
          <LastUsedPill />
        </Show>
        <Show when={passkeyLogin.errorMessage()}>
          {(message) => (
            <p class={pageStyles.formError} role="alert">
              {message()}
            </p>
          )}
        </Show>
        <Show
          when={
            passkeyLogin.activeFlow() !== undefined &&
            !passkeyLogin.busy() &&
            passkeyLogin.supported()
          }
        >
          <button
            type="button"
            class={linkStyles.passkeyLink}
            onClick={() => {
              void passkeyLogin.retry();
            }}
          >
            Reintentar con clave de acceso
          </button>
        </Show>
      </div>

      <div class={pageStyles.separator} />

      <form
        class={pageStyles.credentialForm}
        action={passwordLoginMutation}
        method="post"
        onSubmit={() => {
          loginMethods.markUsed("password");
        }}
      >
        <LoginFeedback message={passwordError()} />

        <Input
          id="auth-username"
          type="text"
          aria-label="Usuario"
          placeholder="Usuario"
          name="identifier"
          autocomplete="username"
          autocapitalize="none"
          autocorrect="off"
          spellcheck={false}
          value={username()}
          onInput={(event) => {
            handleUsernameInput(event.currentTarget.value);
          }}
          ref={(element) => {
            usernameInputRef = element;
          }}
          required
        />

        <Input
          id="current-password"
          type="password"
          aria-label="Contraseña"
          placeholder="Contraseña"
          name="password"
          autocomplete="current-password"
          required
        />

        <div class={pageStyles.ssoButtonContainer}>
          <Button type="submit" variant="primary" class={fullStyles.full}>
            Iniciar sesión
          </Button>
          <Show when={loginMethods.lastUsedMethod() === "password"}>
            <LastUsedPill />
          </Show>
        </div>
      </form>

      <div class={pageStyles.loginFooter}>
        <a href="/reset-password" class={linkStyles.forgotLink}>
          ¿Olvidaste tu contraseña?
        </a>
        <LegalFooter />
      </div>
    </div>
  );
}

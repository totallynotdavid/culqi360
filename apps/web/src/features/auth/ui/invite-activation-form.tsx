import { useSubmissions } from "@solidjs/router";
import { createMemo, createSignal } from "solid-js";

import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import type { InviteActivationView } from "~/contracts/auth";
import { parseWireError } from "~/contracts/errors";
import { acceptInvitePasswordMutation } from "~/features/auth/data/mutations";

import { LoginFeedback } from "./login-feedback";

import styles from "./invite-activation-form.module.css";

export function InviteActivationForm(props: {
  token: string;
  info: InviteActivationView;
}) {
  const submissions = useSubmissions(acceptInvitePasswordMutation);
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");

  const mismatchError = createMemo(() =>
    confirmPassword().length > 0 && password() !== confirmPassword()
      ? "Las contraseñas no coinciden"
      : undefined,
  );

  const actionError = () => {
    const error = submissions.at(-1)?.error;
    return error ? parseWireError(error).message : undefined;
  };

  return (
    <form
      class={styles.formStack}
      action={acceptInvitePasswordMutation}
      method="post"
    >
      <input type="hidden" name="token" value={props.token} />
      <div class={styles.readonlyStack}>
        <Input
          placeholder="Nombre completo"
          type="text"
          value={props.info.fullName}
          disabled
        />
        <Input
          placeholder="Usuario"
          type="text"
          value={props.info.username}
          disabled
        />
        <Input
          placeholder="Correo"
          type="email"
          value={props.info.email}
          disabled
        />
      </div>
      <p class={styles.supportText}>
        Este perfil fue provisionado por RR.HH. Solo debes definir tu contraseña
        para continuar.
      </p>
      <LoginFeedback message={mismatchError() ?? actionError()} />
      <Input
        placeholder="Contraseña"
        type="password"
        name="password"
        value={password()}
        onInput={(event) => setPassword(event.currentTarget.value)}
        autocomplete="new-password"
        required
      />
      <Input
        placeholder="Confirmar contraseña"
        type="password"
        name="confirmPassword"
        value={confirmPassword()}
        onInput={(event) => setConfirmPassword(event.currentTarget.value)}
        autocomplete="new-password"
        required
      />
      <Button
        type="submit"
        class={styles.full}
        disabled={mismatchError() !== undefined}
      >
        Activar cuenta
      </Button>
    </form>
  );
}

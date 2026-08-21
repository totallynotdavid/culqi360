import { useParams, type RouteDefinition } from "@solidjs/router";
import { Match, Switch, createMemo } from "solid-js";

import { useAuthPageView } from "~/features/auth/services/use-auth-analytics";
import { AuthFlowShell } from "~/features/auth/ui/auth-flow-shell";
import { InviteActivationForm } from "~/features/auth/ui/invite-activation-form";
import { inviteActivationViewQuery } from "~/rpc/auth/invite-activation";

import pageStyles from "~/features/auth/ui/login-page.module.css";

export const route = {
  preload: ({ params }) => inviteActivationViewQuery(params.token ?? ""),
} satisfies RouteDefinition;

export default function LoginInvitePage() {
  useAuthPageView("login");
  const params = useParams<{ token: string }>();
  const token = () => params.token ?? "";
  const inviteInfo = createMemo(() => inviteActivationViewQuery(token()));

  return (
    <AuthFlowShell
      title="Activar cuenta"
      description="Define tu contraseña para activar la cuenta. Tu perfil ya está listo."
    >
      <Switch>
        <Match when={inviteInfo() === null}>
          <p class={pageStyles.formError} role="alert">
            Esta invitación no es válida o ya expiró.
          </p>
        </Match>
        <Match when={inviteInfo()}>
          {(info) => <InviteActivationForm token={token()} info={info()} />}
        </Match>
      </Switch>
    </AuthFlowShell>
  );
}

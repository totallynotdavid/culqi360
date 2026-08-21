import { useSearchParams } from "@solidjs/router";
import { onSettled } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { useAuthPageView } from "~/features/auth/services/use-auth-analytics";
import { AuthFlowShell } from "~/features/auth/ui/auth-flow-shell";
import { LoginHome } from "~/features/auth/ui/login-home";

export default function LoginPage() {
  useAuthPageView("login");
  const [searchParams] = useSearchParams();
  const { enqueueErrorSnackBar } = useSnackBar();

  onSettled(() => {
    if (searchParams.error === "google_not_linked") {
      enqueueErrorSnackBar("Tu cuenta no tiene Google vinculado.");
    }
    if (searchParams.error === "strong_auth_required") {
      enqueueErrorSnackBar(
        "Tu cuenta requiere un factor adicional para completar el acceso.",
      );
    }
  });

  return (
    <AuthFlowShell title="Bienvenido.">
      <LoginHome />
    </AuthFlowShell>
  );
}

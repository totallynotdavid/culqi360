import { useAction, useSubmissions } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";

import { createActionPending } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/layout/table";
import { actionErrorMessage } from "~/contracts/errors";
import { formatAppDateTime } from "~/domain/time/app-time";
import { loginRetryReportMutation } from "~/features/auth/data/security-mutations";

import styles from "./login-retries-card.module.css";

function labelFor(stage: string): string {
  if (stage === "challenge") {
    return "Desafío de clave de acceso";
  }

  if (stage === "verify") {
    return "Verificación de clave de acceso";
  }

  return "Inicio de sesión con contraseña";
}

export function LoginRetriesCard() {
  const [email, setEmail] = createSignal("");
  const { enqueueErrorSnackBar, enqueueInfoSnackBar } = useSnackBar();
  const lookup = useAction(loginRetryReportMutation);
  const reports = useSubmissions(loginRetryReportMutation);
  const looking = createActionPending(loginRetryReportMutation);
  const report = () => reports.at(-1)?.result;

  async function handleLookup(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    try {
      const next = await lookup(email().trim());

      if (!next) {
        enqueueInfoSnackBar("Usuario no encontrado");
      }
    } catch (error: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    }
  }

  return (
    <section class={styles.root}>
      <form class={styles.form} onSubmit={(event) => void handleLookup(event)}>
        <Input
          type="email"
          label="Correo del usuario"
          value={email()}
          onInput={(event) => setEmail(event.currentTarget.value)}
          required
        />

        <Button type="submit" loading={looking()}>
          Ver reporte
        </Button>
      </form>

      <Show when={report()}>
        {(data) => (
          <div class={styles.report}>
            <p class={styles.user}>
              {data().user.fullName} ({data().user.email})
            </p>

            <div class={styles.stats}>
              <div class={styles.statCard}>
                <p class={styles.statLabel}>
                  Reintentos en los últimos 15 minutos
                </p>
                <p class={styles.statValue}>{data().retryCount15m}</p>
              </div>

              <div class={styles.statCard}>
                <p class={styles.statLabel}>
                  Reintentos en las últimas 24 horas
                </p>
                <p class={styles.statValue}>{data().retryCount24h}</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                <For each={data().recentRetries}>
                  {(event) => (
                    <TableRow>
                      <TableCell>
                        {formatAppDateTime(event.createdAt)}
                      </TableCell>
                      <TableCell>{labelFor(event.stage)}</TableCell>
                      <TableCell>{event.outcome}</TableCell>
                      <TableCell>{event.reason}</TableCell>
                    </TableRow>
                  )}
                </For>
              </TableBody>
            </Table>
          </div>
        )}
      </Show>
    </section>
  );
}

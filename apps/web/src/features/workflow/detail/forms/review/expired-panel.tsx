import { useAction } from "@solidjs/router";
import { createSignal, Show } from "solid-js";

import { Button } from "~/components/ui/input/button";
import { actionErrorMessage } from "~/contracts/errors";
import {
  WidgetCard,
  WidgetCardActions,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";

import { restartQuotationMutation } from "../../../data/command-mutations";
import { revalidateWorkflowLead } from "../../../data/revalidate-workflow";

import styles from "./qualify-form.module.css";

export function ExpiredPanel(props: { leadId: string; canRestart: boolean }) {
  const restart = useAction(restartQuotationMutation);

  const [submitting, setSubmitting] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  async function handleRestart() {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await restart({ leadId: props.leadId });
      revalidateWorkflowLead(props.leadId);
    } catch (caught) {
      setErrorMessage(actionErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WidgetCard variant="side-column">
      <WidgetCardHeader>
        <WidgetCardTitle text="Reserva vencida" />
      </WidgetCardHeader>

      <WidgetCardContent>
        <Show
          when={props.canRestart}
          fallback={
            <p class={styles.warning}>
              La reserva de tarifa expiró. Solo back office o el ejecutivo
              pueden reiniciar la cotización.
            </p>
          }
        >
          <p class={styles.warning}>
            La reserva de tarifa expiró. Reinicia la cotización con la última
            propuesta como punto de partida.
          </p>
          {errorMessage() && <p class={styles.error}>{errorMessage()}</p>}
          <WidgetCardActions>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={submitting()}
              onClick={() => void handleRestart()}
            >
              Reiniciar cotización
            </Button>
          </WidgetCardActions>
        </Show>
      </WidgetCardContent>
    </WidgetCard>
  );
}

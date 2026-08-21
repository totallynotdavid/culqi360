import { useAction } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";

import { Button } from "~/components/ui/input/button";
import { Select } from "~/components/ui/input/select";
import { Textarea } from "~/components/ui/input/textarea";
import { actionErrorMessage } from "~/contracts/errors";
import { describeCloseReason } from "~/contracts/workflow/close-reason-labels";
import {
  CLOSE_REASONS,
  isCloseReason,
  type CloseReason,
} from "~/contracts/workflow/vocabulary";
import { WidgetCard, WidgetCardContent } from "~/features/widgets/widget-card";
import { closeLeadMutation } from "~/features/workflow/data/command-mutations";
import { revalidateWorkflowLead } from "~/features/workflow/data/revalidate-workflow";

import styles from "./close-quotation.module.css";

export function CloseQuotationSection(props: { leadId: string }) {
  const close = useAction(closeLeadMutation);

  const [open, setOpen] = createSignal(false);
  const [reason, setReason] = createSignal<CloseReason | "">("");
  const [note, setNote] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  function reset() {
    setOpen(false);
    setReason("");
    setNote("");
    setErrorMessage(null);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (submitting()) {
      return;
    }

    const selected = reason();
    if (!selected) {
      setErrorMessage("Selecciona un motivo de cierre.");
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);
    try {
      await close({
        leadId: props.leadId,
        reason: selected,
        note: note().trim() || null,
      });
      revalidateWorkflowLead(props.leadId);
    } catch (caught) {
      setErrorMessage(actionErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Show
      when={open()}
      fallback={
        <div class={styles.closeTrigger}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
          >
            Cerrar cotización
          </Button>
        </div>
      }
    >
      <WidgetCard variant="side-column">
        <WidgetCardContent>
          <form class={styles.closeForm} onSubmit={(e) => void handleSubmit(e)}>
            <p class={styles.closeTitle}>Cerrar cotización</p>
            <Select
              label="Motivo"
              required
              value={reason()}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setReason(isCloseReason(value) ? value : "");
              }}
            >
              <option value="" disabled>
                Selecciona un motivo
              </option>
              <For each={CLOSE_REASONS}>
                {(value) => (
                  <option value={value}>{describeCloseReason(value)}</option>
                )}
              </For>
            </Select>
            <Textarea
              label="Nota (opcional)"
              value={note()}
              onInput={(e) => setNote(e.currentTarget.value)}
              placeholder="Detalle adicional del cierre..."
            />

            <Show when={errorMessage()}>
              {(message) => <p class={styles.error}>{message()}</p>}
            </Show>

            <div class={styles.closeActions}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={reset}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                loading={submitting()}
              >
                Confirmar cierre
              </Button>
            </div>
          </form>
        </WidgetCardContent>
      </WidgetCard>
    </Show>
  );
}

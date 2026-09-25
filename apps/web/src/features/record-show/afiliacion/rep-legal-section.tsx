import { useAction } from "@solidjs/router";
import { Show, createSignal } from "solid-js";

import Mail from "~/components/icons/mail";
import Package from "~/components/icons/package";
import Phone from "~/components/icons/phone";
import User from "~/components/icons/user";
import { Button } from "~/components/ui/input/button";
import { TextInput } from "~/components/ui/input/text-input";
import { actionErrorMessage } from "~/contracts/errors";
import type { LeadDetailView } from "~/contracts/workflow/views";
import {
  FieldInputValue,
  FieldRow,
  FieldTable,
  FieldTextValue,
  RecordInlineCell,
} from "~/features/widgets/field-table";
import {
  WidgetCardActions,
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";
import { recordRepLegalMutation } from "~/features/workflow/data/command-mutations";
import { revalidateWorkflowLead } from "~/features/workflow/data/revalidate-workflow";

import formStyles from "./section-form.module.css";

export function RepLegalSection(props: {
  leadId: string;
  data: LeadDetailView;
}) {
  const record = useAction(recordRepLegalMutation);

  const canEdit = () => props.data.lead.stage === "SETUP" && !repLegal();
  const repLegal = () => props.data.repLegal;

  const [nombres, setNombres] = createSignal(repLegal()?.nombres ?? "");
  const [apellidoPaterno, setApellidoPaterno] = createSignal(
    repLegal()?.apellidoPaterno ?? "",
  );
  const [apellidoMaterno, setApellidoMaterno] = createSignal(
    repLegal()?.apellidoMaterno ?? "",
  );
  const [dni, setDni] = createSignal(repLegal()?.dni ?? "");
  const [telefono, setTelefono] = createSignal(repLegal()?.telefono ?? "");
  const [email, setEmail] = createSignal(repLegal()?.email ?? "");

  const [saving, setSaving] = createSignal(false);
  const [saveErrorMessage, setSaveErrorMessage] = createSignal<string | null>(
    null,
  );

  async function handleSave(e: SubmitEvent) {
    e.preventDefault();
    setSaveErrorMessage(null);
    setSaving(true);
    try {
      await record({
        leadId: props.leadId,
        nombres: nombres().trim(),
        apellidoPaterno: apellidoPaterno().trim(),
        apellidoMaterno: apellidoMaterno().trim(),
        dni: dni().trim(),
        telefono: telefono().trim(),
        email: email().trim(),
      });
      revalidateWorkflowLead(props.leadId);
    } catch (caught) {
      setSaveErrorMessage(actionErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <WidgetCard>
      <WidgetCardHeader>
        <WidgetCardTitle text="Representante legal" />
      </WidgetCardHeader>
      <WidgetCardContent>
        <Show
          when={canEdit()}
          fallback={
            <Show
              when={repLegal()}
              fallback={
                <div class={formStyles.emptyState}>
                  Sin datos de representante legal
                </div>
              }
            >
              {(rl) => (
                <FieldTable>
                  <RecordInlineCell label="Nombres" icon={User}>
                    <FieldTextValue>{rl().nombres}</FieldTextValue>
                  </RecordInlineCell>
                  <RecordInlineCell label="Apellido paterno" icon={User}>
                    <FieldTextValue>{rl().apellidoPaterno}</FieldTextValue>
                  </RecordInlineCell>
                  <RecordInlineCell label="Apellido materno" icon={User}>
                    <FieldTextValue>{rl().apellidoMaterno}</FieldTextValue>
                  </RecordInlineCell>
                  <RecordInlineCell label="DNI" icon={Package}>
                    <FieldTextValue>{rl().dni}</FieldTextValue>
                  </RecordInlineCell>
                  <RecordInlineCell
                    label="Teléfono"
                    icon={Phone}
                    empty={!rl().telefono}
                  >
                    <FieldTextValue>{rl().telefono}</FieldTextValue>
                  </RecordInlineCell>
                  <RecordInlineCell
                    label="Email"
                    icon={Mail}
                    empty={!rl().email}
                  >
                    <FieldTextValue>{rl().email}</FieldTextValue>
                  </RecordInlineCell>
                </FieldTable>
              )}
            </Show>
          }
        >
          <form onSubmit={(e) => void handleSave(e)}>
            <FieldTable>
              <FieldRow label="Nombres" icon={User}>
                <FieldInputValue>
                  <TextInput
                    sizeVariant="sm"
                    value={nombres()}
                    onChange={setNombres}
                    required
                  />
                </FieldInputValue>
              </FieldRow>
              <FieldRow label="Apellido paterno" icon={User}>
                <FieldInputValue>
                  <TextInput
                    sizeVariant="sm"
                    value={apellidoPaterno()}
                    onChange={setApellidoPaterno}
                    required
                  />
                </FieldInputValue>
              </FieldRow>
              <FieldRow label="Apellido materno" icon={User}>
                <FieldInputValue>
                  <TextInput
                    sizeVariant="sm"
                    value={apellidoMaterno()}
                    onChange={setApellidoMaterno}
                    required
                  />
                </FieldInputValue>
              </FieldRow>
              <FieldRow label="DNI" icon={Package}>
                <FieldInputValue>
                  <TextInput
                    sizeVariant="sm"
                    value={dni()}
                    onChange={setDni}
                    required
                  />
                </FieldInputValue>
              </FieldRow>
              <FieldRow label="Teléfono" icon={Phone}>
                <FieldInputValue>
                  <TextInput
                    sizeVariant="sm"
                    type="tel"
                    value={telefono()}
                    onChange={setTelefono}
                  />
                </FieldInputValue>
              </FieldRow>
              <FieldRow label="Email" icon={Mail}>
                <FieldInputValue>
                  <TextInput
                    sizeVariant="sm"
                    type="email"
                    value={email()}
                    onChange={setEmail}
                  />
                </FieldInputValue>
              </FieldRow>
            </FieldTable>

            <Show when={saveErrorMessage()}>
              {(msg) => <p class={formStyles.error}>{msg()}</p>}
            </Show>

            <WidgetCardActions align="start">
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                loading={saving()}
              >
                Guardar datos
              </Button>
            </WidgetCardActions>
          </form>
        </Show>
      </WidgetCardContent>
    </WidgetCard>
  );
}

import { type RouteDefinition, useAction } from "@solidjs/router";
import { Loading, Show, createMemo, type Accessor } from "solid-js";
import { createStore } from "solid-js";

import { createActionPending } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { Spinner } from "~/components/feedback/spinner/spinner";
import {
  SettingsOptionCard,
  SettingsOptionCardCounterRow,
  SettingsOptionCardToggleRow,
} from "~/components/settings/settings-option-card";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Button } from "~/components/ui/input/button";
import { actionErrorMessage } from "~/contracts/errors";
import { formatAppDateTime } from "~/domain/time/app-time";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";
import {
  updatePendingQuotationPolicyMutation,
  updateRateProposalPolicyMutation,
} from "~/features/workflow/data/settings-mutations";
import { pendingQuotationPolicyQuery } from "~/rpc/workflow/pending-quotation-policy";
import { rateProposalPolicyQuery } from "~/rpc/workflow/rate-proposal-policy";

import styles from "./settings-page.module.css";

type RateProposalPolicySnapshot = Awaited<
  ReturnType<typeof rateProposalPolicyQuery>
>;

type PendingQuotationPolicySnapshot = Awaited<
  ReturnType<typeof pendingQuotationPolicyQuery>
>;

export const route = {
  preload: () => {
    void rateProposalPolicyQuery();
    void pendingQuotationPolicyQuery();
  },
} satisfies RouteDefinition;

function RateProposalPolicyEditor(props: {
  snapshot: Accessor<RateProposalPolicySnapshot>;
}) {
  const initialSnapshot = props.snapshot();
  const updatePolicy = useAction(updateRateProposalPolicyMutation);
  const saving = createActionPending(updateRateProposalPolicyMutation);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [draft, setDraft] = createStore({
    validityDays: initialSnapshot.validityDays,
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    try {
      await updatePolicy({
        validityDays: draft.validityDays,
      });

      enqueueSuccessSnackBar("Vigencia actualizada");
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  return (
    <SettingsSection title="Vigencia de propuestas">
      <form class={styles.stack} onSubmit={(event) => void handleSubmit(event)}>
        <SettingsOptionCard>
          <SettingsOptionCardCounterRow
            title="Vigencia de propuesta"
            description={`Días que tiene el ejecutivo para aceptar una tarifa propuesta. Predeterminado del sistema: ${props.snapshot().defaultValidityDays} días.`}
            ariaLabel="Vigencia de propuesta (días)"
            value={draft.validityDays}
            min={1}
            max={90}
            onChange={(validityDays) =>
              setDraft((current) => {
                current.validityDays = validityDays;
              })
            }
          />
        </SettingsOptionCard>

        <Show when={props.snapshot().updatedAt}>
          {(updatedAt) => (
            <p class={styles.helperText}>
              Última actualización: {formatAppDateTime(updatedAt())}.
            </p>
          )}
        </Show>

        <div class={styles.formActions}>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            loading={saving()}
          >
            Guardar
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

function PendingQuotationPolicyEditor(props: {
  snapshot: Accessor<PendingQuotationPolicySnapshot>;
}) {
  const initialSnapshot = props.snapshot();
  const updatePolicy = useAction(updatePendingQuotationPolicyMutation);
  const saving = createActionPending(updatePendingQuotationPolicyMutation);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [draft, setDraft] = createStore({
    enabled: initialSnapshot.enabled,
    limit: initialSnapshot.limit,
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    try {
      await updatePolicy(
        draft.enabled
          ? {
              enabled: true,
              limit: draft.limit,
            }
          : {
              enabled: false,
            },
      );

      enqueueSuccessSnackBar(
        draft.enabled ? "Límite actualizado" : "Límite desactivado",
      );
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  return (
    <SettingsSection title="Clientes pendientes por ejecutivo">
      <form class={styles.stack} onSubmit={(event) => void handleSubmit(event)}>
        <SettingsOptionCard>
          <SettingsOptionCardToggleRow
            interactive
            title="Aplicar límite de clientes pendientes"
            description="Desactivado de forma predeterminada. Al activarlo, el ejecutivo deberá aceptar, enviar a revisión o cerrar sus cotizaciones pendientes antes de registrar nuevos clientes."
            value={draft.enabled}
            onChange={(enabled) =>
              setDraft((current) => {
                current.enabled = enabled;
              })
            }
          />

          <Show when={draft.enabled}>
            <SettingsOptionCardCounterRow
              title="Máximo de clientes pendientes"
              description="Se bloquea el registro de nuevos clientes cuando el ejecutivo alcanza este número."
              value={draft.limit}
              min={1}
              max={50}
              onChange={(limit) =>
                setDraft((current) => {
                  current.limit = limit;
                })
              }
            />
          </Show>
        </SettingsOptionCard>

        <Show when={props.snapshot().updatedAt}>
          {(updatedAt) => (
            <p class={styles.helperText}>
              Última actualización: {formatAppDateTime(updatedAt())}.
            </p>
          )}
        </Show>

        <div class={styles.formActions}>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            loading={saving()}
          >
            Guardar
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

export default function QuotationPoliciesPage() {
  const rateProposalPolicy = createMemo(() => rateProposalPolicyQuery());
  const pendingQuotationPolicy = createMemo(() =>
    pendingQuotationPolicyQuery(),
  );

  return (
    <SettingsPageLayout>
      <Loading fallback={<Spinner />}>
        <RateProposalPolicyEditor snapshot={rateProposalPolicy} />
        <PendingQuotationPolicyEditor snapshot={pendingQuotationPolicy} />
      </Loading>
    </SettingsPageLayout>
  );
}

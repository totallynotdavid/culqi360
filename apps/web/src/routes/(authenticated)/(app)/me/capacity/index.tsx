import { useAction } from "@solidjs/router";
import { createMemo, createSignal } from "solid-js";

import { SettingsSection } from "~/components/settings/SettingsSection";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import {
  requestMoreLeadRefillMutation,
  requestMoreSearchesMutation,
} from "~/features/capacity/data/mutations";
import { SettingsPageContainer } from "~/features/settings-shell/content/settings-page-container";
import { myContactAssignmentCapacityQuery } from "~/rpc/capacity/my-contact-assignment-capacity";
import { mySearchAllowanceQuery } from "~/rpc/capacity/my-search-allowance";

import styles from "./capacity-page.module.css";

function CapacityStatus(props: { value: string; caption: string }) {
  return (
    <div class={styles.status}>
      <span class={styles.statusValue}>{props.value}</span>
      <span class={styles.statusCaption}>{props.caption}</span>
    </div>
  );
}

function CapacityRequestForm(props: {
  initialAmount: string;
  onRequest: (amount: number, reason: string) => void;
}) {
  const [amount, setAmount] = createSignal(props.initialAmount);
  const [reason, setReason] = createSignal("");

  return (
    <form
      class={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        props.onRequest(Number(amount()), reason());
      }}
    >
      <div class={styles.formFields}>
        <div class={styles.amountField}>
          <Input
            type="number"
            label="Cantidad"
            value={amount()}
            onInput={(event) => setAmount(event.currentTarget.value)}
            required
          />
        </div>
        <div class={styles.reasonField}>
          <Input
            label="Motivo"
            value={reason()}
            onInput={(event) => setReason(event.currentTarget.value)}
            required
          />
        </div>
      </div>
      <div class={styles.formActions}>
        <Button type="submit" variant="secondary" size="sm">
          Enviar solicitud
        </Button>
      </div>
    </form>
  );
}

export default function MyCapacityPage() {
  const searchStatus = createMemo(() => mySearchAllowanceQuery());
  const leadStatus = createMemo(() => myContactAssignmentCapacityQuery());
  const requestSearches = useAction(requestMoreSearchesMutation);
  const requestRefill = useAction(requestMoreLeadRefillMutation);

  const searchLimit = () =>
    (searchStatus()?.policy.monthlyLimit ?? 0) + (searchStatus()?.granted ?? 0);

  return (
    <SettingsPageContainer>
      <SettingsSection
        title="Búsquedas del mes"
        description="Tu consumo actual de búsquedas y solicitudes de ampliación."
      >
        <CapacityStatus
          value={`${searchStatus()?.committed ?? 0}/${searchLimit()}`}
          caption={`${searchStatus()?.remaining ?? 0} restantes`}
        />
        <CapacityRequestForm
          initialAmount="25"
          onRequest={(amount, reason) => void requestSearches(amount, reason)}
        />
      </SettingsSection>

      <SettingsSection
        title="Asignaciones de clientes"
        description="Tus clientes activos y solicitudes de nuevas asignaciones."
      >
        <CapacityStatus
          value={`${leadStatus()?.activeAssignments ?? 0}/${leadStatus()?.policy.bufferTarget ?? 0}`}
          caption={`${leadStatus()?.remaining ?? 0} asignaciones disponibles hoy`}
        />
        <CapacityRequestForm
          initialAmount="10"
          onRequest={(amount, reason) => void requestRefill(amount, reason)}
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}

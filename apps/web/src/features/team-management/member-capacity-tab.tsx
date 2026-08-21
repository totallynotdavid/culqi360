import { useAction } from "@solidjs/router";
import { For, Show, createMemo, createSignal, type Accessor } from "solid-js";
import { createStore } from "solid-js";

import { createActionTarget } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import {
  CapacityLimitFields,
  type CapacityLimitsDraft,
} from "~/components/settings/capacity-limit-fields";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import type {
  CapacityRequestStatus,
  ExecutiveCapacityDetailView,
  PolicySource,
} from "~/contracts/capacity";
import { actionErrorMessage } from "~/contracts/errors";
import {
  grantMoreLeadRefillMutation,
  grantMoreSearchesMutation,
  updateExecutivePolicyOverrideMutation,
} from "~/features/capacity/data/mutations";
import { executiveCapacityDetailQuery } from "~/rpc/capacity/executive-capacity-detail";

import styles from "./team-management.module.css";

const POLICY_SOURCE_LABEL: Record<PolicySource, string> = {
  system: "Límite del sistema",
  branch: "Límite de sucursal",
  team: "Límite del equipo",
  user: "Límite personalizado",
};

const REQUEST_STATUS_LABEL: Record<CapacityRequestStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  canceled: "Cancelada",
};

export function MemberCapacityTab(props: { userId: string }) {
  const detail = createMemo(() => executiveCapacityDetailQuery(props.userId));

  return (
    <Show
      when={detail()}
      fallback={
        <p class={styles.rosterEmpty}>Este usuario no gestiona capacidad.</p>
      }
    >
      {(snapshot) => <MemberCapacityEditor detail={snapshot} />}
    </Show>
  );
}

function MemberCapacityEditor(props: {
  detail: Accessor<ExecutiveCapacityDetailView>;
}) {
  const initialDetail = props.detail();
  const grantSearches = useAction(grantMoreSearchesMutation);
  const grantRefill = useAction(grantMoreLeadRefillMutation);
  const saveOverrideAction = useAction(updateExecutivePolicyOverrideMutation);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const executiveId = () => props.detail().executive.id;

  // Every member tab is mounted against one executive, so comparing the id the
  // action is acting on is what keeps another tab's grant from lighting up here.
  const searchGrantTarget = createActionTarget(grantMoreSearchesMutation);
  const refillGrantTarget = createActionTarget(grantMoreLeadRefillMutation);
  const overrideTarget = createActionTarget(
    updateExecutivePolicyOverrideMutation,
  );

  const grantingSearches = () => searchGrantTarget() === executiveId();
  const grantingRefill = () => refillGrantTarget() === executiveId();
  const savingOverride = () => overrideTarget()?.userId === executiveId();

  const [searchGrant, setSearchGrant] = createSignal("25");
  const [leadGrant, setLeadGrant] = createSignal("10");

  const [override, setOverride] = createStore<CapacityLimitsDraft>({
    searchLimit: String(initialDetail.searchStatus.policy.monthlyLimit),
    bufferTarget: String(initialDetail.leadStatus.policy.bufferTarget),
    dailyRefillLimit: String(initialDetail.leadStatus.policy.dailyLimit),
  });

  async function handleGrantSearches() {
    try {
      await grantSearches(
        executiveId(),
        Number(searchGrant()),
        "Ajuste manual",
      );
      enqueueSuccessSnackBar("Búsquedas otorgadas");
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  async function handleGrantRefill() {
    try {
      await grantRefill(executiveId(), Number(leadGrant()), "Ajuste manual");
      enqueueSuccessSnackBar("Asignaciones otorgadas");
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  async function saveOverride() {
    try {
      await saveOverrideAction({
        userId: executiveId(),
        monthlySearchLimit: Number(override.searchLimit),
        activeBufferTarget: Number(override.bufferTarget),
        dailyRefillLimit: Number(override.dailyRefillLimit),
        expiresAt: null,
      });
      enqueueSuccessSnackBar("Límite personalizado actualizado");
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  return (
    <>
      <SettingsSection
        title="Política efectiva"
        description="Los límites que rigen hoy para este usuario y de dónde provienen."
      >
        <div class={styles.capacityCards}>
          <div class={styles.capacityCard}>
            <span class={styles.capacityCardLabel}>Búsquedas</span>
            <span class={styles.capacityCardValue}>
              {props.detail().searchStatus.policy.monthlyLimit} por mes
            </span>
            <span class={styles.capacityCardMeta}>
              Fuente:{" "}
              {POLICY_SOURCE_LABEL[props.detail().searchStatus.policy.source]}
            </span>
          </div>
          <div class={styles.capacityCard}>
            <span class={styles.capacityCardLabel}>Clientes activos</span>
            <span class={styles.capacityCardValue}>
              Límite {props.detail().leadStatus.policy.bufferTarget} ·
              Asignaciones diarias {props.detail().leadStatus.policy.dailyLimit}
            </span>
            <span class={styles.capacityCardMeta}>
              Fuente:{" "}
              {POLICY_SOURCE_LABEL[props.detail().leadStatus.policy.source]}
            </span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Estado actual"
        description="Consumo del periodo en curso."
      >
        <div class={styles.capacityCards}>
          <div class={styles.capacityCard}>
            <span class={styles.capacityCardLabel}>Búsquedas del mes</span>
            <span class={styles.capacityCardValue}>
              {props.detail().searchStatus.committed}/
              {props.detail().searchStatus.policy.monthlyLimit +
                props.detail().searchStatus.granted}
            </span>
            <span class={styles.capacityCardMeta}>
              {props.detail().searchStatus.remaining} restantes
            </span>
          </div>
          <div class={styles.capacityCard}>
            <span class={styles.capacityCardLabel}>Clientes activos</span>
            <span class={styles.capacityCardValue}>
              {props.detail().leadStatus.activeAssignments}/
              {props.detail().leadStatus.policy.bufferTarget} activos
            </span>
            <span class={styles.capacityCardMeta}>
              {props.detail().leadStatus.remaining} asignaciones disponibles hoy
            </span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Otorgar capacidad"
        description="Concede búsquedas o asignaciones adicionales por única vez."
      >
        <div class={styles.capacityGrantGrid}>
          <form
            class={styles.capacityForm}
            onSubmit={(event) => {
              event.preventDefault();
              void handleGrantSearches();
            }}
          >
            <span class={styles.capacityCardLabel}>Búsquedas extra</span>
            <Input
              type="number"
              label="Cantidad"
              value={searchGrant()}
              onInput={(event) => setSearchGrant(event.currentTarget.value)}
              required
            />
            <div class={styles.capacityActions}>
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                loading={grantingSearches()}
              >
                Otorgar
              </Button>
            </div>
          </form>

          <form
            class={styles.capacityForm}
            onSubmit={(event) => {
              event.preventDefault();
              void handleGrantRefill();
            }}
          >
            <span class={styles.capacityCardLabel}>
              Asignaciones adicionales
            </span>
            <Input
              type="number"
              label="Cantidad"
              value={leadGrant()}
              onInput={(event) => setLeadGrant(event.currentTarget.value)}
              required
            />
            <div class={styles.capacityActions}>
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                loading={grantingRefill()}
              >
                Otorgar
              </Button>
            </div>
          </form>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Límite personalizado"
        description="Fija límites para este usuario por encima del límite de su equipo."
      >
        <form
          class={styles.capacityForm}
          onSubmit={(event) => {
            event.preventDefault();
            void saveOverride();
          }}
        >
          <CapacityLimitFields draft={override} setDraft={setOverride} />
          <div class={styles.capacityActions}>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              loading={savingOverride()}
            >
              Guardar límite
            </Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title="Historial de solicitudes">
        <Show
          when={props.detail().requests.length > 0}
          fallback={
            <p class={styles.rosterEmpty}>Sin solicitudes registradas.</p>
          }
        >
          <div class={styles.requestList}>
            <For each={props.detail().requests}>
              {(request) => (
                <div class={styles.requestItem}>
                  <span class={styles.requestTitle}>
                    {request.kind === "search_extra"
                      ? "Más búsquedas"
                      : "Más asignaciones"}{" "}
                    · {request.requestedAmount}
                  </span>
                  <span class={styles.requestMeta}>
                    {REQUEST_STATUS_LABEL[request.status]} · {request.reason}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </SettingsSection>
    </>
  );
}

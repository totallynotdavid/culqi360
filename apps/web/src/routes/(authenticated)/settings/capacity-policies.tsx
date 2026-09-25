import { useAction } from "@solidjs/router";
import { For, Loading, createMemo, type Accessor } from "solid-js";
import { createStore } from "solid-js";

import { createActionTarget } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { Spinner } from "~/components/feedback/spinner/spinner";
import {
  CapacityLimitFields,
  type CapacityLimitsDraft,
} from "~/components/settings/capacity-limit-fields";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Button } from "~/components/ui/input/button";
import type {
  CapacityPolicyDefaultsView,
  CapacityPolicyTeamDefaultsView,
} from "~/contracts/capacity";
import { actionErrorMessage } from "~/contracts/errors";
import { updateScopePolicyMutation } from "~/features/capacity/data/mutations";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";
import { capacityPolicyDefaultsQuery } from "~/rpc/capacity/capacity-policy-defaults";

import styles from "./settings-page.module.css";

function TeamPolicyRow(props: {
  team: Accessor<CapacityPolicyTeamDefaultsView>;
  branchDefaults: Accessor<CapacityPolicyDefaultsView>;
}) {
  const initialTeam = props.team();
  const initialBranchDefaults = props.branchDefaults();
  const savePolicy = useAction(updateScopePolicyMutation);

  // Only this team's row shows the pending state.
  const savingScope = createActionTarget(updateScopePolicyMutation);
  const saving = () => {
    const scope = savingScope();
    return scope?.scopeType === "team" && scope.scopeId === props.team().teamId;
  };

  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [draft, setDraft] = createStore<CapacityLimitsDraft>({
    searchLimit: String(
      initialTeam.searchLimit ??
        initialBranchDefaults.branchSearchLimit ??
        2_000,
    ),
    bufferTarget: String(
      initialTeam.activeBufferTarget ??
        initialBranchDefaults.branchActiveBufferTarget ??
        10,
    ),
    dailyRefillLimit: String(
      initialTeam.dailyRefillLimit ??
        initialBranchDefaults.branchDailyRefillLimit ??
        25,
    ),
  });

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    try {
      await savePolicy({
        scopeType: "team",
        scopeId: props.team().teamId,
        monthlySearchLimit: Number(draft.searchLimit),
        activeBufferTarget: Number(draft.bufferTarget),
        dailyRefillLimit: Number(draft.dailyRefillLimit),
      });

      enqueueSuccessSnackBar("Límites del equipo actualizados");
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  return (
    <form class={styles.teamCard} onSubmit={(event) => void save(event)}>
      <div class={styles.teamCardHeader}>
        <span class={styles.teamName}>{props.team().teamName}</span>
        <span class={styles.teamMeta}>
          Búsquedas {props.team().searchLimit ?? "(hereda)"} · Clientes activos{" "}
          {props.team().activeBufferTarget ?? "(hereda)"} · Asignaciones diarias{" "}
          {props.team().dailyRefillLimit ?? "(hereda)"}
        </span>
      </div>

      <CapacityLimitFields draft={draft} setDraft={setDraft} />

      <div class={styles.formActions}>
        <Button type="submit" size="sm" variant="secondary" loading={saving()}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

function CapacityPoliciesEditor(props: {
  snapshot: Accessor<CapacityPolicyDefaultsView>;
}) {
  const initialSnapshot = props.snapshot();
  const savePolicy = useAction(updateScopePolicyMutation);
  const savingScope = createActionTarget(updateScopePolicyMutation);
  const saving = () => savingScope()?.scopeType === "branch";
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [branchDraft, setBranchDraft] = createStore<CapacityLimitsDraft>({
    searchLimit: String(initialSnapshot.branchSearchLimit ?? 2_000),
    bufferTarget: String(initialSnapshot.branchActiveBufferTarget ?? 10),
    dailyRefillLimit: String(initialSnapshot.branchDailyRefillLimit ?? 25),
  });

  async function saveBranch(): Promise<void> {
    try {
      await savePolicy({
        scopeType: "branch",
        scopeId: props.snapshot().branchId,
        monthlySearchLimit: Number(branchDraft.searchLimit),
        activeBufferTarget: Number(branchDraft.bufferTarget),
        dailyRefillLimit: Number(branchDraft.dailyRefillLimit),
      });

      enqueueSuccessSnackBar("Límites de sucursal actualizados");
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  return (
    <>
      <SettingsSection
        title="Sucursal"
        description="Define los límites de búsquedas, clientes activos y asignaciones diarias de la sucursal. Los equipos los heredan salvo que definan los suyos."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveBranch();
          }}
        >
          <CapacityLimitFields draft={branchDraft} setDraft={setBranchDraft} />

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

      <SettingsSection
        title="Equipos"
        description="Ajusta los límites por equipo. Deja el valor heredado para usar el límite de la sucursal."
      >
        <div class={styles.teamList}>
          {/* Preserve each row's draft when query results are revalidated. */}
          <For each={props.snapshot().teams} keyed={(team) => team.teamId}>
            {(team) => (
              <TeamPolicyRow team={team} branchDefaults={props.snapshot} />
            )}
          </For>
        </div>
      </SettingsSection>
    </>
  );
}

export default function CapacityPoliciesPage() {
  const defaults = createMemo(() => capacityPolicyDefaultsQuery());

  return (
    <SettingsPageLayout>
      <Loading fallback={<Spinner />}>
        <CapacityPoliciesEditor snapshot={defaults} />
      </Loading>
    </SettingsPageLayout>
  );
}

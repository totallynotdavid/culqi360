import { useAction } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";

import { SettingsSection } from "~/components/settings/SettingsSection";
import { Button } from "~/components/ui/input/button";
import { Checkbox } from "~/components/ui/input/checkbox";
import { Input } from "~/components/ui/input/input";
import { Select } from "~/components/ui/input/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/layout/table";
import { upsertAuditPolicyMutation } from "~/features/audit-policies/data/mutations";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";
import { auditPolicySnapshotQuery } from "~/rpc/audit-policies/audit-policy-snapshot";
import { canManageAuditPoliciesQuery } from "~/rpc/audit-policies/can-manage-audit-policies";

import styles from "./settings-page.module.css";

type PolicyRiskLevel = "high" | "medium" | "low";

const RISK_LEVEL_LABELS: Record<PolicyRiskLevel, string> = {
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

function riskLevelLabel(value: string): string {
  return value === "high" || value === "medium" || value === "low"
    ? RISK_LEVEL_LABELS[value]
    : value;
}

function parseRiskLevel(value: string): PolicyRiskLevel {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return "medium";
}

export default function SecurityPoliciesPage() {
  const [action, setAction] = createSignal("");
  const [riskLevel, setRiskLevel] = createSignal<PolicyRiskLevel>("medium");
  const [isActive, setIsActive] = createSignal(true);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const policySnapshot = createMemo(() => auditPolicySnapshotQuery());
  const canManagePolicies = createMemo(() => canManageAuditPoliciesQuery(), {
    loadingValue: false,
  });

  const saveAuditPolicy = useAction(upsertAuditPolicyMutation);

  const rows = createMemo(() => policySnapshot()?.items ?? []);
  const canSubmit = createMemo(
    () => canManagePolicies() && action().trim().length > 0,
  );

  async function handleSave(): Promise<void> {
    const normalizedAction = action().trim();

    setErrorMessage(null);

    try {
      await saveAuditPolicy({
        action: normalizedAction,
        riskLevel: riskLevel(),
        isActive: isActive(),
      });
    } catch {
      setErrorMessage(
        "No se pudo guardar la política. Revisa los valores y los permisos.",
      );
    }
  }

  return (
    <SettingsPageLayout>
      <SettingsSection
        title="Políticas de riesgo de auditoría"
        description="Las acciones sin política explícita se tratan como de alto riesgo para evitar ocultar eventos críticos."
      >
        <Table aria-label="Políticas de seguridad" variant="list">
          <colgroup>
            <col />
            <col style={{ width: "90px" }} />
            <col style={{ width: "80px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "130px" }} />
          </colgroup>

          <TableHeader>
            <TableRow>
              <TableHead>Acción</TableHead>
              <TableHead>Riesgo</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead>Protegido</TableHead>
              <TableHead>Actualizada por</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            <Show
              when={rows().length > 0}
              fallback={
                <TableRow>
                  <TableCell colspan={5}>
                    <span class={styles.helperText}>
                      {policySnapshot() === undefined
                        ? "Cargando..."
                        : "No hay políticas registradas."}
                    </span>
                  </TableCell>
                </TableRow>
              }
            >
              <For each={rows()}>
                {(item) => (
                  <TableRow>
                    <TableCell ellipsis>
                      <span class={styles.strong}>{item.action}</span>
                    </TableCell>
                    <TableCell>{riskLevelLabel(item.riskLevel)}</TableCell>
                    <TableCell>{item.isActive ? "Sí" : "No"}</TableCell>
                    <TableCell>{item.isProtected ? "Sí" : "No"}</TableCell>
                    <TableCell ellipsis>
                      {item.updatedByUserId ? `#${item.updatedByUserId}` : null}
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </Show>
          </TableBody>
        </Table>
      </SettingsSection>

      <SettingsSection
        title="Definir política"
        description="Solo admin y superuser pueden editar políticas."
      >
        <div class={styles.policyForm}>
          <div class={styles.filterAction}>
            <Input
              label="Acción"
              value={action()}
              onInput={(event) => setAction(event.currentTarget.value)}
              placeholder="leads_requested"
            />
          </div>

          <div class={styles.filterRiskLevel}>
            <Select
              label="Nivel de riesgo"
              value={riskLevel()}
              onInput={(event) =>
                setRiskLevel(parseRiskLevel(event.currentTarget.value))
              }
            >
              <option value="high">Alto</option>
              <option value="medium">Medio</option>
              <option value="low">Bajo</option>
            </Select>
          </div>

          <Checkbox
            label="Activo"
            checked={isActive()}
            onInput={(event) => setIsActive(event.currentTarget.checked)}
          />

          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canSubmit()}
            onClick={() => void handleSave()}
          >
            Guardar política
          </Button>
        </div>

        <Show when={errorMessage()}>
          {(message) => <p class={styles.errorText}>{message()}</p>}
        </Show>
      </SettingsSection>
    </SettingsPageLayout>
  );
}

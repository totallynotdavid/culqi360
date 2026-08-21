import { revalidate, useAction, useNavigate } from "@solidjs/router";
import { Match, Switch } from "solid-js";

import { downloadWithToken } from "~/browser/files/client";
import { createActionPending } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { AppPageBody } from "~/components/layout/page";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { Button } from "~/components/ui/input/button";
import { actionErrorMessage } from "~/contracts/errors";
import { PUBLISHED_GPV_KEYS } from "~/contracts/query-keys";
import { hasPermission } from "~/domain/auth/access/rbac";
import {
  TabStrip,
  type TabItem,
} from "~/features/side-panel/components/tab-strip";

import { CommissionTab } from "./commission/commission-tab";
import { CulqiView } from "./culqi/culqi-view";
import { requestMerchantGpvExportMutation } from "./data/mutations";
import { GpvFilterBar } from "./gpv-filter-bar";
import { type GpvTabId, useGpvView } from "./gpv-view";
import { AttributionGrid } from "./grids/attribution-grid";
import { CohortGrid } from "./grids/cohort-grid";
import { PerformanceTab } from "./performance-tab";

import styles from "./merchant-gpv-dashboard.module.css";

const BASE_GPV_TABS: ReadonlyArray<TabItem<GpvTabId>> = [
  { id: "rendimiento", label: "Rendimiento" },
  { id: "cohortes", label: "Cohortes" },
  { id: "atribucion", label: "Atribución" },
  { id: "culqi", label: "Vista Culqi" },
];

// revalidate only marks the queries stale; a failed refetch surfaces at the
// read site through the boundary, not here.
function refreshData(): void {
  revalidate([...PUBLISHED_GPV_KEYS]);
}

export function MerchantGpvDashboard() {
  const view = useGpvView();
  const navigate = useNavigate();
  const requestExport = useAction(requestMerchantGpvExportMutation);
  const exporting = createActionPending(requestMerchantGpvExportMutation);
  const { enqueueErrorSnackBar } = useSnackBar();
  const { currentUser } = useAuthenticatedSession();

  // Tab visibility is UX only; the RPC enforces `commission:read`.
  const canReadCommission = () =>
    hasPermission(currentUser().role, "commission:read");

  const gpvTabs = (): ReadonlyArray<TabItem<GpvTabId>> =>
    canReadCommission()
      ? [...BASE_GPV_TABS, { id: "comisiones", label: "Comisiones" }]
      : BASE_GPV_TABS;

  async function exportReport() {
    try {
      const { token } = await requestExport(view.filter());

      downloadWithToken(token);
    } catch (error) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    }
  }

  return (
    <AppPageBody>
      <TabStrip
        tabs={gpvTabs()}
        activeTab={view.tab()}
        onTabSelect={view.setTab}
        rightComponent={
          <div class={styles.tabActions}>
            <Button
              variant="secondary"
              size="sm"
              loading={exporting()}
              onClick={() => void exportReport()}
            >
              Exportar resultado
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/dashboards/merchant-gpv/imports/new")}
            >
              Importar reporte
            </Button>

            <Button variant="secondary" onClick={refreshData}>
              Recargar
            </Button>
          </div>
        }
      />

      <GpvFilterBar view={view} />

      <Switch>
        <Match when={view.tab() === "rendimiento"}>
          <PerformanceTab view={view} />
        </Match>

        <Match when={view.tab() === "cohortes"}>
          <CohortGrid view={view} />
        </Match>

        <Match when={view.tab() === "atribucion"}>
          <AttributionGrid view={view} />
        </Match>

        <Match when={view.tab() === "culqi"}>
          <CulqiView view={view} />
        </Match>

        <Match when={view.tab() === "comisiones" && canReadCommission()}>
          <CommissionTab />
        </Match>
      </Switch>
    </AppPageBody>
  );
}

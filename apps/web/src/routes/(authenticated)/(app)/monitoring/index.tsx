import { revalidate } from "@solidjs/router";
import {
  Errored,
  For,
  Loading,
  Show,
  createMemo,
  createSignal,
  isPending,
} from "solid-js";

import { Spinner } from "~/components/feedback/spinner/spinner";
import Activity from "~/components/icons/activity";
import CircleAlert from "~/components/icons/circle-alert";
import CircleCheckBig from "~/components/icons/circle-check-big";
import CircleQuestionMark from "~/components/icons/circle-question-mark";
import { Button } from "~/components/ui/input/button";
import { Select } from "~/components/ui/input/select";
import type { ObservabilitySnapshot } from "~/contracts/observability/snapshot";
import { DataGrid } from "~/features/data-grid/components/grid";
import { createGridSource } from "~/features/data-grid/model/create-grid-source";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { useSidePanelRowOpen } from "~/features/side-panel/hooks/use-side-panel-row-open";
import { createDataGridDetailSidePanelPage } from "~/features/side-panel/types/side-panel-page";
import { observabilitySnapshotQuery } from "~/rpc/observability/observability-snapshot";

import styles from "./monitoring-page.module.css";

type MonitoringStatus = "all" | "ok" | "error";
type MonitoringRow = ObservabilitySnapshot["summary"][number];

const WINDOW_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 60, label: "1 hora" },
  { value: 240, label: "4 horas" },
  { value: 1440, label: "24 horas" },
] as const;

const MONITORING_COLUMNS = [
  {
    key: "actionName",
    label: "Acción",
    icon: Activity,
    minWidth: 240,
    grow: true,
    sticky: true,
    renderCell: (row) => row.actionName,
  },
  {
    key: "count",
    label: "Ejecuciones",
    icon: CircleCheckBig,
    width: 140,
    renderCell: (row) => row.count,
  },
  {
    key: "errorCount",
    label: "Errores",
    icon: CircleAlert,
    width: 120,
    renderCell: (row) => row.errorCount,
  },
  {
    key: "avgDurationMs",
    label: "Promedio (ms)",
    icon: CircleQuestionMark,
    width: 150,
    renderCell: (row) => Math.round(row.avgDurationMs),
  },
  {
    key: "maxDurationMs",
    label: "Máximo (ms)",
    icon: CircleQuestionMark,
    width: 140,
    renderCell: (row) => Math.round(row.maxDurationMs),
  },
] satisfies ReadonlyArray<DataGridColumn<MonitoringRow>>;

function parseStatus(value: string): MonitoringStatus {
  if (value === "ok" || value === "error") {
    return value;
  }
  return "all";
}

function reload(): void {
  revalidate(observabilitySnapshotQuery.key);
}

export default function MonitoringPage() {
  const [windowMinutes, setWindowMinutes] = createSignal(60);
  const [status, setStatus] = createSignal<MonitoringStatus>("all");

  const queryParams = createMemo(() => ({
    windowMinutes: windowMinutes(),
    status: status() === "all" ? undefined : status(),
    limit: 80,
  }));
  const { source } = createGridSource(
    () => observabilitySnapshotQuery(queryParams()),
    (snapshot) => ({ rows: snapshot.summary }),
  );

  // The boundary owns the first load; this only reports an in-flight
  // replacement for content that is already on screen.
  const refreshing = () => isPending(() => source());

  const rowOpen = useSidePanelRowOpen<MonitoringRow>((row) =>
    createDataGridDetailSidePanelPage({
      title: row.actionName,
      subtitle: `${row.errorCount} errores`,
      items: [
        { label: "Ejecuciones", value: String(row.count) },
        { label: "Errores", value: String(row.errorCount) },
        {
          label: "Promedio (ms)",
          value: String(Math.round(row.avgDurationMs)),
        },
        { label: "Máximo (ms)", value: String(Math.round(row.maxDurationMs)) },
      ],
    }),
  );

  return (
    <div class={styles.page}>
      <div class={styles.toolbar}>
        <div class={styles.control}>
          <Select
            aria-label="Ventana de tiempo"
            value={windowMinutes()}
            onInput={(e) => setWindowMinutes(Number(e.currentTarget.value))}
          >
            <For each={WINDOW_OPTIONS}>
              {(option) => <option value={option.value}>{option.label}</option>}
            </For>
          </Select>
        </div>
        <div class={styles.control}>
          <Select
            aria-label="Estado"
            value={status()}
            onInput={(e) => setStatus(parseStatus(e.currentTarget.value))}
          >
            <option value="all">Todos</option>
            <option value="ok">OK</option>
            <option value="error">Errores</option>
          </Select>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={refreshing()}
          onClick={reload}
        >
          Recargar
        </Button>
        <Show when={refreshing()}>
          <span class={styles.refreshing}>Actualizando...</span>
        </Show>
      </div>

      <Loading fallback={<Spinner size="lg" />}>
        <Errored
          fallback={
            <p class={styles.refreshing}>No se pudieron cargar las métricas.</p>
          }
        >
          <DataGrid
            ariaLabel="Monitoreo"
            columns={MONITORING_COLUMNS}
            emptyState="No hay métricas disponibles para la ventana actual."
            onRowOpen={rowOpen}
            rowId={(row) => row.actionName}
            rowOpenIndicator="panel"
            source={source()}
          />
        </Errored>
      </Loading>
    </div>
  );
}

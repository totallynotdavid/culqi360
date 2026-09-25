import { useNavigate } from "@solidjs/router";
import { createMemo, createSignal, Errored, Show, Loading } from "solid-js";

import { EmptyState } from "~/components/feedback/empty-state/empty";
import Building2 from "~/components/icons/building-2";
import CalendarDays from "~/components/icons/calendar-days";
import ChartColumn from "~/components/icons/chart-column";
import CircleCheckBig from "~/components/icons/circle-check-big";
import { AppPageBody } from "~/components/layout/page";
import { Badge } from "~/components/ui/display/badge";
import { Skeleton } from "~/components/ui/feedback/skeleton";
import { Button } from "~/components/ui/input/button";
import { SearchInput } from "~/components/ui/input/search-input";
import type {
  ExecutiveGpvMerchantView,
  ExecutiveGpvProgressView,
} from "~/contracts/merchant-stats/views";
import { formatCalendarDate } from "~/domain/time/app-time";
import {
  calendarDateParts,
  type CalendarDate,
  type CalendarMonth,
} from "~/domain/time/calendar-date";
import { DataGrid } from "~/features/data-grid/components/grid";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { WidgetCardShell } from "~/features/widgets/widget-card-shell";
import { WidgetGrid, WidgetGridItem } from "~/features/widgets/widget-layout";
import { WidgetSkeleton } from "~/features/widgets/widget-skeleton";
import { executiveGpvProgressQuery } from "~/rpc/merchant-stats/executive-gpv-progress";

import { Gauge } from "../charts/gauge";
import {
  formatInteger,
  formatMonth,
  formatRatio,
  formatSoles,
} from "../format";
import { AggregateTile } from "../tiles";

import styles from "./executive-gpv-progress.module.css";

const DAY_MS = 86_400_000;

type StatusFilter = "all" | "attention";

export function ExecutiveGpvProgress() {
  const portfolio = createMemo(() => executiveGpvProgressQuery());

  return (
    <AppPageBody>
      <Loading fallback={<PortfolioLoading />}>
        <Errored fallback={<PortfolioError />}>
          <Show when={portfolio()}>
            {(data) => <PortfolioContent portfolio={data()} />}
          </Show>
        </Errored>
      </Loading>
    </AppPageBody>
  );
}

function PortfolioContent(props: { portfolio: ExecutiveGpvProgressView }) {
  const navigate = useNavigate();
  const merchants = () => props.portfolio.merchants;

  const [search, setSearch] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal<StatusFilter>("all");

  const totalGpv = createMemo(() =>
    merchants().reduce((sum, merchant) => sum + merchant.gpv, 0),
  );

  const totalProjectedGpv = createMemo(() =>
    merchants().reduce(
      (sum, merchant) => sum + (merchant.projectedGpv ?? 0),
      0,
    ),
  );

  // `null` means the commission scheme has no activation threshold.
  const hasActivationBar = createMemo(() =>
    merchants().some((merchant) => merchant.isActive !== null),
  );

  const activeCount = createMemo(
    () => merchants().filter((merchant) => merchant.isActive === true).length,
  );

  const attentionCount = createMemo(
    () => merchants().filter((merchant) => merchant.isActive === false).length,
  );

  const filteredMerchants = createMemo(() => {
    const query = search().trim().toLowerCase();
    const onlyAttention = statusFilter() === "attention";

    return merchants().filter((merchant) => {
      if (onlyAttention && merchant.isActive !== false) {
        return false;
      }

      if (!query) {
        return true;
      }

      return `${merchant.name} ${merchant.ruc}`.toLowerCase().includes(query);
    });
  });

  const emptyState = createMemo(() => {
    if (merchants().length === 0) {
      return {
        title: "Aún no tienes comercios asignados.",
        description:
          "Los comercios aparecerán aquí cuando se te asigne su gestión.",
      };
    }

    if (statusFilter() === "attention") {
      return {
        title: "Todo al día.",
        description: "Ningún comercio necesita atención por ahora.",
      };
    }

    return {
      title: "Sin resultados.",
      description: "Intenta con otro nombre o RUC.",
    };
  });

  const columns = createMemo(() => merchantColumns(props.portfolio.cutDate));

  return (
    <>
      <Show when={merchants().length > 0}>
        <div class={styles.summary}>
          <WidgetGrid>
            <WidgetGridItem span={hasActivationBar() ? "half" : "full"}>
              <WidgetCardShell title="GPV del mes">
                <Gauge
                  actual={totalGpv()}
                  target={totalProjectedGpv()}
                  caption={gaugeCaption(
                    props.portfolio.month,
                    props.portfolio.cutDate,
                  )}
                />
              </WidgetCardShell>
            </WidgetGridItem>

            <Show when={hasActivationBar()}>
              <AggregateTile
                title="Comercios activos"
                span="quarter"
                value={`${formatInteger(activeCount())}/${formatInteger(merchants().length)}`}
                caption={`${formatRatio(activeCount(), merchants().length)} del portafolio`}
              />

              <AggregateTile
                title="Necesitan atención"
                span="quarter"
                value={formatInteger(attentionCount())}
                caption={
                  attentionCount() > 0
                    ? "Bajo el mínimo de activación"
                    : "Todo al día"
                }
              />
            </Show>
          </WidgetGrid>

          <div class={styles.toolbar}>
            <span class={styles.toolbarLabel}>
              Mis comercios · {formatInteger(merchants().length)}
            </span>

            <SearchInput
              class={styles.search}
              value={search()}
              onValueChange={setSearch}
              placeholder="Buscar por comercio o RUC..."
              aria-label="Buscar comercio"
            />

            <Show when={hasActivationBar()}>
              <div class={styles.toggleGroup}>
                <Button
                  variant={statusFilter() === "all" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  Todos ({formatInteger(merchants().length)})
                </Button>

                <Button
                  variant={
                    statusFilter() === "attention" ? "primary" : "secondary"
                  }
                  size="sm"
                  onClick={() => setStatusFilter("attention")}
                >
                  Necesitan atención ({formatInteger(attentionCount())})
                </Button>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <DataGrid
        ariaLabel="Mis comercios"
        columns={columns()}
        emptyState={
          <EmptyState
            title={emptyState().title}
            description={emptyState().description}
          />
        }
        rowId={(merchant) => merchant.ruc}
        rowOpenIndicator="route"
        source={{ rows: filteredMerchants() }}
        onRowOpen={(merchant) =>
          navigate(
            merchant.leadId
              ? `/records/${merchant.leadId}`
              : `/records?query=${encodeURIComponent(merchant.ruc)}`,
          )
        }
      />
    </>
  );
}

function gaugeCaption(
  month: CalendarMonth | null,
  cutDate: CalendarDate | null,
): string {
  const monthLabel = month ? formatMonth(month) : "el mes actual";

  if (!cutDate) {
    return `${monthLabel} · GPV pendiente de actualización`;
  }

  return `${monthLabel} · Actualizado al ${formatCalendarDate(cutDate)}`;
}

function PortfolioLoading() {
  return (
    <>
      <div class={styles.summary}>
        <WidgetGrid>
          <WidgetGridItem span="half">
            <WidgetSkeleton />
          </WidgetGridItem>
          <WidgetGridItem span="quarter">
            <WidgetSkeleton />
          </WidgetGridItem>
          <WidgetGridItem span="quarter">
            <WidgetSkeleton />
          </WidgetGridItem>
        </WidgetGrid>

        <Skeleton width={280} height={32} />
      </div>

      <div class={styles.loadingBody}>
        <Skeleton height={280} />
      </div>
    </>
  );
}

function PortfolioError() {
  return (
    <EmptyState
      title="No se pudo cargar tu portafolio"
      description="Vuelve a intentarlo en unos segundos."
    />
  );
}

function merchantColumns(
  cutDate: CalendarDate | null,
): ReadonlyArray<DataGridColumn<ExecutiveGpvMerchantView>> {
  return [
    {
      key: "merchant",
      label: "Comercio",
      icon: Building2,
      minWidth: 240,
      grow: true,
      sticky: true,
      renderCell: (merchant) => (
        <div class={styles.merchant}>
          <span class={styles.merchantName}>{merchant.name}</span>
          <span class={styles.ruc}>{merchant.ruc}</span>
        </div>
      ),
    },
    {
      key: "progress",
      label: "Progreso individual",
      icon: ChartColumn,
      width: 260,
      renderCell: (merchant) => (
        <div class={styles.progress}>
          <span>{formatSoles(merchant.gpv)}</span>

          <Show
            when={merchant.projectedGpv !== null}
            fallback={<span class={styles.muted}>Sin objetivo</span>}
          >
            <span class={styles.muted}>
              de {formatSoles(merchant.projectedGpv ?? 0)} ·{" "}
              {formatRatio(merchant.gpv, merchant.projectedGpv ?? 0)}
            </span>
          </Show>
        </div>
      ),
    },
    {
      key: "activation",
      label: "Activación",
      icon: CircleCheckBig,
      width: 130,
      renderCell: (merchant) => (
        <Badge variant={activationVariant(merchant.isActive)}>
          {activationLabel(merchant.isActive)}
        </Badge>
      ),
    },
    {
      key: "lastTransaction",
      label: "Última transacción",
      icon: CalendarDays,
      width: 190,
      renderCell: (merchant) => (
        <span class={styles.muted}>
          {lastTransactionLabel(merchant.lastTransactionAt, cutDate)}
        </span>
      ),
    },
  ];
}

function activationVariant(isActive: boolean | null) {
  if (isActive === null) {
    return "warning" as const;
  }

  return isActive ? ("success" as const) : ("secondary" as const);
}

function activationLabel(isActive: boolean | null): string {
  if (isActive === null) {
    return "Pendiente";
  }

  return isActive ? "Activo" : "Inactivo";
}

function lastTransactionLabel(
  lastTransaction: CalendarDate | null,
  cutDate: CalendarDate | null,
): string {
  if (!lastTransaction) {
    return "Sin transacciones";
  }

  if (!cutDate) {
    return formatCalendarDate(lastTransaction);
  }

  const days = daysBetween(lastTransaction, cutDate);

  if (days === 0) {
    return "Hoy";
  }

  if (days === 1) {
    return "Hace 1 día";
  }

  return `Hace ${days} días`;
}

function daysBetween(from: CalendarDate, to: CalendarDate): number {
  const fromParts = calendarDateParts(from);
  const toParts = calendarDateParts(to);

  const fromTime = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toTime = Date.UTC(toParts.year, toParts.month - 1, toParts.day);

  return Math.max(0, Math.floor((toTime - fromTime) / DAY_MS));
}

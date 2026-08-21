import { For, createMemo, Errored, Show, Loading } from "solid-js";

import { EmptyState } from "~/components/feedback/empty-state/empty";
import type { GpvPerformanceView } from "~/contracts/merchant-stats/views";
import { WidgetCardShell } from "~/features/widgets/widget-card-shell";
import {
  WidgetCanvas,
  WidgetGrid,
  WidgetGridItem,
  type WidgetSpan,
} from "~/features/widgets/widget-layout";
import { WidgetSkeleton } from "~/features/widgets/widget-skeleton";
import { gpvPerformanceViewQuery } from "~/rpc/merchant-stats/gpv-performance-view";

import {
  formatInteger,
  formatMonth,
  formatRatio,
  formatSolesCompact,
} from "./format";
import type { GpvView } from "./gpv-view";
import { QualityPanel } from "./quality/quality-panel";
import { AggregateTile, BarTile, RampTile } from "./tiles";

const MAX_RAMP_SERIES = 5;

const STAT_SPANS = [
  "quarter",
  "quarter",
  "quarter",
  "quarter",
  "quarter",
] satisfies readonly WidgetSpan[];

const CHART_SPANS = [
  "half",
  "half",
  "half",
  "half",
] satisfies readonly WidgetSpan[];

export function PerformanceTab(props: { view: GpvView }) {
  const performance = createMemo(() =>
    gpvPerformanceViewQuery({ filter: props.view.filter() }),
  );

  const readyPerformance = () => {
    const view = performance();

    return view?.kind === "ready" ? view : null;
  };

  return (
    <Loading fallback={<TabSkeleton />}>
      <Errored fallback={<TabError />}>
        <Show
          when={readyPerformance()}
          fallback={
            <EmptyState
              title="Sin datos de GPV"
              description="Importa un reporte para ver las métricas del panel."
            />
          }
        >
          {(view) => <PerformanceContent view={view()} />}
        </Show>
      </Errored>
    </Loading>
  );
}

function PerformanceContent(props: {
  view: Extract<GpvPerformanceView, { kind: "ready" }>;
}) {
  const monthLabel = () => formatMonth(props.view.month);

  const projectedGpvTotal = createMemo(() =>
    props.view.attainment.sellers.reduce(
      (sum, seller) => sum + (seller.projectedGpv ?? 0),
      0,
    ),
  );

  return (
    <WidgetCanvas>
      <WidgetGrid>
        <AggregateTile
          title={`GPV ${monthLabel()}`}
          span="quarter"
          value={formatSolesCompact(props.view.attainment.coverage.cohortGpv)}
          caption={`${formatInteger(
            props.view.attainment.coverage.cohortDeviceCount,
          )} dispositivos vendidos`}
        />

        <AggregateTile
          title={`Atribución ${monthLabel()}`}
          span="quarter"
          value={formatRatio(
            props.view.attainment.coverage.attributedGpv,
            props.view.attainment.coverage.totalGpv,
          )}
          caption={`${formatSolesCompact(
            props.view.attainment.coverage.totalGpv -
              props.view.attainment.coverage.attributedGpv,
          )} sin asignar`}
        />

        <AggregateTile
          title={`Cumplimiento ${monthLabel()}`}
          span="quarter"
          value={formatRatio(
            props.view.attainment.coverage.attributedGpv,
            projectedGpvTotal(),
          )}
          caption={`Objetivo ${formatSolesCompact(projectedGpvTotal())}`}
        />

        <AggregateTile
          title="Tasa de activación"
          span="quarter"
          value={formatRatio(
            props.view.lifecycle.activatedCount,
            props.view.lifecycle.salesTotal,
          )}
          caption={
            props.view.lifecycle.medianDaysToActivate == null
              ? `${formatInteger(props.view.lifecycle.salesTotal)} ventas`
              : `Mediana ${props.view.lifecycle.medianDaysToActivate} días hasta activar`
          }
        />

        <AggregateTile
          title="Comercios sin transacciones"
          span="quarter"
          value={formatInteger(props.view.lifecycle.dormantCount)}
          caption={`Inactivos hace ${props.view.lifecycle.dormantThresholdDays}+ días`}
        />
      </WidgetGrid>

      <WidgetGrid>
        <RampTile
          title="Curva de rampa por cohorte"
          span="half"
          series={props.view.ramp.slice(-MAX_RAMP_SERIES).map((series) => ({
            key: series.saleMonth,
            label: series.saleMonth,
            points: series.points.map((point) => ({
              offset: point.offset,
              value: point.gpv,
            })),
          }))}
          target={props.view.ramp.at(-1)?.projectedGpv ?? null}
        />

        <BarTile
          title={`Cumplimiento ${monthLabel()} por vendedor`}
          span="half"
          rows={props.view.attainment.sellers.slice(0, 10).map((seller) => ({
            key: seller.id ?? "unassigned",
            label: seller.label,
            sublabel: seller.sublabel ?? undefined,
            value: seller.gpv,
            target: seller.projectedGpv,
            href: seller.id
              ? `/settings/members/${seller.id}?tab=capacity`
              : undefined,
          }))}
        />

        <BarTile
          title={`Cumplimiento ${monthLabel()} por zonal`}
          span="half"
          rows={props.view.attainment.branches.map((branch) => ({
            key: branch.id ?? "unassigned",
            label: branch.label,
            value: branch.gpv,
            target: branch.projectedGpv,
          }))}
        />

        <WidgetGridItem span="half">
          <WidgetCardShell title="Calidad de datos">
            <QualityPanel summary={props.view.quality} />
          </WidgetCardShell>
        </WidgetGridItem>
      </WidgetGrid>
    </WidgetCanvas>
  );
}

function TabError() {
  return (
    <WidgetCanvas>
      <WidgetGrid>
        <WidgetGridItem span="full">
          <WidgetCardShell title="Rendimiento GPV" status="error">
            <span />
          </WidgetCardShell>
        </WidgetGridItem>
      </WidgetGrid>
    </WidgetCanvas>
  );
}

function TabSkeleton() {
  return (
    <WidgetCanvas>
      <WidgetGrid>
        <For keyed={false} each={STAT_SPANS}>
          {(span) => (
            <WidgetGridItem span={span()}>
              <WidgetSkeleton />
            </WidgetGridItem>
          )}
        </For>
      </WidgetGrid>

      <WidgetGrid>
        <For keyed={false} each={CHART_SPANS}>
          {(span) => (
            <WidgetGridItem span={span()}>
              <WidgetSkeleton />
            </WidgetGridItem>
          )}
        </For>
      </WidgetGrid>
    </WidgetCanvas>
  );
}

import { Show } from "solid-js";

import TrendingDown from "~/components/icons/trending-down";
import TrendingUp from "~/components/icons/trending-up";
import { WidgetCardShell } from "~/features/widgets/widget-card-shell";
import {
  WidgetGridItem,
  type WidgetSpan,
} from "~/features/widgets/widget-layout";

import { BarList, type BarRow } from "./charts/bar-list";
import { RampChart, type RampSeries } from "./charts/ramp-chart";

import styles from "./tiles.module.css";

// Omit trendPercentage to render value-only (no prior period to compare).
export function AggregateTile(props: {
  title: string;
  span: WidgetSpan;
  value: string;
  caption?: string;
  trendPercentage?: number;
  href?: string;
}) {
  const trend = () => props.trendPercentage;

  const body = () => (
    <div class={styles.aggregate}>
      <div class={styles.aggregateBody}>
        <span class={styles.aggregateValue}>{props.value}</span>
        <Show when={props.caption}>
          {(caption) => <span class={styles.caption}>{caption()}</span>}
        </Show>
      </div>
      <Show when={trend() !== undefined}>
        <div class={styles.trend}>
          <span class={styles.trendValue}>{formatTrend(trend() ?? 0)}%</span>
          <Show
            when={(trend() ?? 0) >= 0}
            fallback={<TrendingDown size={16} class={styles.trendIconDown} />}
          >
            <TrendingUp size={16} class={styles.trendIconUp} />
          </Show>
        </div>
      </Show>
    </div>
  );

  return (
    <WidgetGridItem span={props.span}>
      <WidgetCardShell title={props.title}>
        <Show when={props.href} fallback={body()}>
          {(href) => (
            <a class={styles.aggregateLink} href={href()}>
              {body()}
            </a>
          )}
        </Show>
      </WidgetCardShell>
    </WidgetGridItem>
  );
}

function formatTrend(trendPercentage: number): string {
  return trendPercentage >= 0 ? `+${trendPercentage}` : `${trendPercentage}`;
}

export function RampTile(props: {
  title: string;
  span: WidgetSpan;
  series: RampSeries[];
  target?: number | null;
}) {
  return (
    <WidgetGridItem span={props.span}>
      <WidgetCardShell
        title={props.title}
        status={props.series.length ? "ready" : "empty"}
      >
        <RampChart series={props.series} target={props.target} />
      </WidgetCardShell>
    </WidgetGridItem>
  );
}

export function BarTile(props: {
  title: string;
  span: WidgetSpan;
  rows: BarRow[];
}) {
  return (
    <WidgetGridItem span={props.span}>
      <WidgetCardShell
        title={props.title}
        status={props.rows.length ? "ready" : "empty"}
      >
        <BarList rows={props.rows} />
      </WidgetCardShell>
    </WidgetGridItem>
  );
}

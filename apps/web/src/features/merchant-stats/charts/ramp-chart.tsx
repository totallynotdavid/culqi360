import { createMemo, createSignal, For, Show } from "solid-js";

import { borderBoxSize, createResizeRef } from "~/browser/ui/resize-ref";
import { Present } from "~/components/ui/control-flow/present";
import type { CalendarMonth } from "~/domain/time/calendar-date";

import { formatMonth, formatSolesCompact } from "../format";

import styles from "./ramp-chart.module.css";

export interface RampSeries {
  key: string;
  label: CalendarMonth;
  points: Array<{ offset: number; value: number }>;
}

interface RampChartProps {
  series: RampSeries[];
  target?: number | null;
  height?: number;
}

const PAD = { top: 20, right: 16, bottom: 30, left: 16 };
const FALLBACK_WIDTH = 640;
const TOOLTIP_WIDTH = 128;
const TOOLTIP_FALLBACK_HEIGHT = 96;
const TOOLTIP_GAP = 12;
const TOOLTIP_BOUNDARY_PAD = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

const SERIES_COLORS = [
  "var(--color-blue-11)",
  "var(--color-turquoise-11)",
  "var(--color-purple-11)",
  "var(--color-orange-11)",
  "var(--color-pink-11)",
];

// Cohorts share an offset axis, not calendar months, so their ramp shapes compare.
export function RampChart(props: RampChartProps) {
  const height = () => props.height ?? 240;

  const [size, setSize] = createSignal<{ width: number; height: number }>();
  const [tooltipSize, setTooltipSize] = createSignal<{
    width: number;
    height: number;
  }>();
  const [activeOffset, setActiveOffset] = createSignal<number | null>(null);
  const canvasRef = createResizeRef((entry) => setSize(borderBoxSize(entry)));
  const width = () => size()?.width ?? FALLBACK_WIDTH;

  const maxOffset = createMemo(() =>
    Math.max(
      1,
      ...props.series.flatMap((s) => s.points.map((point) => point.offset)),
    ),
  );

  const stepX = () => (width() - PAD.left - PAD.right) / maxOffset();
  const xOf = (offset: number) => PAD.left + stepX() * offset;

  const geometry = createMemo(() => {
    const h = height();
    const innerH = h - PAD.top - PAD.bottom;
    const max = Math.max(
      props.target ?? 0,
      ...props.series.flatMap((s) => s.points.map((p) => p.value)),
      1,
    );

    const lines = props.series.map((series, index) => {
      const coords = series.points
        .toSorted((a, b) => a.offset - b.offset)
        .map((point) => ({
          offset: point.offset,
          value: point.value,
          x: xOf(point.offset),
          y: PAD.top + innerH - (point.value / max) * innerH,
        }));

      return {
        key: series.key,
        label: series.label,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        coords,
        path: coords
          .map(
            (c, i) =>
              `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`,
          )
          .join(" "),
      };
    });

    const targetY =
      props.target != null && props.target > 0
        ? PAD.top + innerH - (props.target / max) * innerH
        : null;

    return { lines, innerH, targetY };
  });

  const tooltip = createMemo(() => {
    const offset = activeOffset();
    if (offset === null) {
      return null;
    }

    const items = geometry()
      .lines.map((line) => ({
        key: line.key,
        label: formatMonth(line.label),
        color: line.color,
        value: line.coords.find((c) => c.offset === offset)?.value,
      }))
      .filter(
        (item): item is typeof item & { value: number } =>
          item.value !== undefined && item.value !== 0,
      );

    if (items.length === 0) {
      return null;
    }
    return { offset, items };
  });

  const anchor = createMemo(() => {
    const active = tooltip();
    if (!active) {
      return null;
    }
    const ys = geometry()
      .lines.flatMap((line) =>
        line.coords.filter((coord) => coord.offset === active.offset),
      )
      .map((coord) => coord.y);
    return { x: xOf(active.offset), y: ys.length ? Math.min(...ys) : PAD.top };
  });

  const tooltipLeft = () => {
    const point = anchor();
    if (!point) {
      return 0;
    }
    const tipWidth = tooltipSize()?.width ?? TOOLTIP_WIDTH;
    const leftPlaced = point.x - tipWidth - TOOLTIP_GAP;
    const placed =
      leftPlaced >= TOOLTIP_BOUNDARY_PAD ? leftPlaced : point.x + TOOLTIP_GAP;
    return clamp(
      placed,
      TOOLTIP_BOUNDARY_PAD,
      width() - tipWidth - TOOLTIP_BOUNDARY_PAD,
    );
  };

  const tooltipTop = () => {
    const point = anchor();
    if (!point) {
      return 0;
    }
    const tipHeight = tooltipSize()?.height ?? TOOLTIP_FALLBACK_HEIGHT;
    return clamp(
      point.y - tipHeight / 2,
      TOOLTIP_BOUNDARY_PAD,
      height() - tipHeight - TOOLTIP_BOUNDARY_PAD,
    );
  };

  const offsetFromPointer = (event: PointerEvent, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const x = ratio * width();
    const nearest = Math.round((x - PAD.left) / stepX());
    return Math.min(maxOffset(), Math.max(0, nearest));
  };

  return (
    <div class={styles.wrap}>
      <div ref={canvasRef} class={styles.canvas}>
        <svg
          viewBox={`0 0 ${width()} ${height()}`}
          width={width()}
          height={height()}
          class={styles.svg}
          role="img"
          aria-label="GPV por cohorte y mes del ciclo"
          onPointerMove={(event) =>
            setActiveOffset(offsetFromPointer(event, event.currentTarget))
          }
          onPointerLeave={() => setActiveOffset(null)}
        >
          <Present when={geometry().targetY}>
            {(targetY) => (
              <line
                x1={PAD.left}
                x2={width() - PAD.right}
                y1={targetY()}
                y2={targetY()}
                stroke="var(--foreground-tertiary)"
                stroke-width="1"
                stroke-dasharray="4 4"
              />
            )}
          </Present>

          <Show when={tooltip()}>
            {(active) => (
              <line
                x1={xOf(active().offset)}
                x2={xOf(active().offset)}
                y1={PAD.top}
                y2={PAD.top + geometry().innerH}
                stroke="var(--foreground)"
                stroke-width="1"
                stroke-opacity="0.5"
                stroke-dasharray="4 4"
              />
            )}
          </Show>

          <For each={geometry().lines}>
            {(line) => (
              <>
                <path
                  d={line.path}
                  fill="none"
                  stroke={line.color}
                  stroke-width="2"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
                <For each={line.coords}>
                  {(coord) => (
                    <circle
                      class={styles.dot}
                      cx={coord.x}
                      cy={coord.y}
                      r={activeOffset() === coord.offset ? 4 : 3}
                      fill={line.color}
                      stroke="var(--background)"
                      stroke-width="2"
                    />
                  )}
                </For>
              </>
            )}
          </For>

          <For each={Array.from({ length: maxOffset() + 1 }, (_, i) => i)}>
            {(offset) => (
              <text
                x={xOf(offset)}
                y={height() - 10}
                text-anchor="middle"
                fill="var(--foreground-tertiary)"
                font-size="10"
              >
                M{offset}
              </text>
            )}
          </For>
        </svg>

        <Show when={tooltip()}>
          {(active) => {
            const tooltipRef = createResizeRef((entry) =>
              setTooltipSize(borderBoxSize(entry)),
            );

            return (
              <div
                ref={tooltipRef}
                class={styles.tooltip}
                style={{ left: `${tooltipLeft()}px`, top: `${tooltipTop()}px` }}
              >
                <span class={styles.tooltipHeader}>M{active().offset}</span>
                <For each={active().items}>
                  {(item) => (
                    <div class={styles.tooltipRow}>
                      <span
                        class={styles.legendSwatch}
                        style={{ "background-color": item.color }}
                        aria-hidden="true"
                      />
                      <span class={styles.tooltipLabel}>{item.label}</span>
                      <span class={styles.tooltipValue}>
                        {formatSolesCompact(item.value)}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            );
          }}
        </Show>
      </div>

      <div class={styles.legend}>
        <For each={geometry().lines}>
          {(line) => (
            <span class={styles.legendItem}>
              <span
                class={styles.legendSwatch}
                style={{ "background-color": line.color }}
                aria-hidden="true"
              />
              {formatMonth(line.label)}
              <span class={styles.legendValue}>
                {formatSolesCompact(
                  line.coords.reduce((sum, c) => sum + c.value, 0),
                )}
              </span>
            </span>
          )}
        </For>
      </div>
    </div>
  );
}

import { createMemo, createSignal, For, Show } from "solid-js";

import { borderBoxSize, createResizeRef } from "~/browser/ui/resize-ref";
import { Present } from "~/components/ui/control-flow/present";
import type { CalendarMonth } from "~/domain/time/calendar-date";

import { formatMonth, formatSolesCompact } from "../format";

interface LinePoint {
  label: CalendarMonth;
  value: number;
}

interface LineChartProps {
  points: LinePoint[];
  target?: number | null;
  height?: number;
}

const PAD = { top: 16, right: 16, bottom: 28, left: 16 };
const FALLBACK_WIDTH = 640;

export function LineChart(props: LineChartProps) {
  const height = () => props.height ?? 220;

  const [size, setSize] = createSignal<{ width: number; height: number }>();
  const resizeRef = createResizeRef((entry) => setSize(borderBoxSize(entry)));
  const width = () => size()?.width ?? FALLBACK_WIDTH;

  const geometry = createMemo(() => {
    const points = props.points;
    const h = height();
    const innerW = width() - PAD.left - PAD.right;
    const innerH = h - PAD.top - PAD.bottom;
    const max = Math.max(props.target ?? 0, ...points.map((p) => p.value), 1);
    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

    const coords = points.map((point, index) => ({
      label: point.label,
      value: point.value,
      x: PAD.left + stepX * index,
      y: PAD.top + innerH - (point.value / max) * innerH,
    }));

    const line = coords
      .map(
        (c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`,
      )
      .join(" ");
    const first = coords[0];
    const last = coords.at(-1);
    const baseline = (PAD.top + innerH).toFixed(1);
    const area =
      first && last
        ? `${line} L${last.x.toFixed(1)},${baseline} L${first.x.toFixed(1)},${baseline} Z`
        : "";

    const maxIndex = coords.reduce(
      (best, c, i) => (c.value > (coords[best]?.value ?? -Infinity) ? i : best),
      0,
    );
    const targetY =
      props.target != null
        ? PAD.top + innerH - (props.target / max) * innerH
        : null;

    return { coords, line, area, innerH, maxIndex, targetY };
  });

  return (
    <div ref={resizeRef} style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${width()} ${height()}`}
        width={width()}
        height={height()}
        style={{ display: "block", "font-family": "inherit" }}
        role="img"
        aria-label="GPV realizado por mes"
      >
        <Present when={geometry().targetY}>
          {(targetY) => (
            <line
              x1={PAD.left}
              x2={width() - PAD.right}
              y1={targetY()}
              y2={targetY()}
              stroke="var(--muted-foreground)"
              stroke-width="1.5"
              stroke-dasharray="4 4"
              opacity="0.7"
            />
          )}
        </Present>

        <path d={geometry().area} fill="var(--color-blue-5)" opacity="0.6" />
        <path
          d={geometry().line}
          fill="none"
          stroke="var(--color-blue-11)"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <For each={geometry().coords}>
          {(coord, index) => (
            <>
              <circle
                cx={coord.x}
                cy={coord.y}
                r={index() === geometry().maxIndex ? 4 : 3}
                fill="var(--color-blue-11)"
                stroke="var(--background)"
                stroke-width="2"
              />
              <Show
                when={
                  index() === geometry().maxIndex ||
                  index() === geometry().coords.length - 1
                }
              >
                <text
                  x={coord.x}
                  y={coord.y - 8}
                  text-anchor="middle"
                  fill="var(--foreground)"
                  font-size="11"
                  font-weight="600"
                >
                  {formatSolesCompact(coord.value)}
                </text>
              </Show>
              <text
                x={coord.x}
                y={height() - 10}
                text-anchor="middle"
                fill="var(--muted-foreground)"
                font-size="10"
              >
                {formatMonth(coord.label)}
              </text>
            </>
          )}
        </For>
      </svg>
    </div>
  );
}

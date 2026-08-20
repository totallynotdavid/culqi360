import { Show } from "solid-js";

import { Present } from "~/components/ui/control-flow/present";

import { formatPercent, formatSoles } from "../format";

import styles from "./gauge.module.css";

interface GaugeProps {
  actual: number;
  target: number | null;
  caption?: string;
}

export function Gauge(props: GaugeProps) {
  // Zero is displayed as a target but cannot supply an attainment ratio.
  const positiveTarget = () =>
    props.target != null && props.target > 0 ? props.target : null;

  const hit = () => props.target != null && props.actual >= props.target;

  return (
    <div class={styles.gauge}>
      <div class={styles.figures}>
        <span class={styles.actual}>{formatSoles(props.actual)}</span>
        <Present when={props.target}>
          {(target) => (
            <span class={styles.target}>
              / {formatSoles(target())} objetivo
            </span>
          )}
        </Present>
      </div>
      <Present when={positiveTarget()}>
        {(target) => (
          <>
            <div class={styles.track}>
              <div
                class={[styles.fill, hit() && styles.fillHit]}
                style={{
                  width: `${Math.min(props.actual / target(), 1) * 100}%`,
                }}
              />
            </div>
            <div class={styles.legend}>
              <span class={hit() && styles.hitText}>
                {formatPercent(props.actual / target())} del objetivo
              </span>
              <Show when={props.caption}>
                <span class={styles.caption}>{props.caption}</span>
              </Show>
            </div>
          </>
        )}
      </Present>
    </div>
  );
}

import { For, Show, createMemo } from "solid-js";

import { merchantStatsByRucQuery } from "~/rpc/merchant-stats/merchant-stats-by-ruc";

import { Gauge } from "../charts/gauge";
import { LineChart } from "../charts/line-chart";
import { formatMonth, formatSolesCompact } from "../format";

import styles from "./merchant-gpv-widget.module.css";

export function MerchantGpvWidget(props: { ruc: string }) {
  const stats = createMemo(() => merchantStatsByRucQuery(props.ruc));

  return (
    <Show when={stats()} keyed>
      {(data) => {
        const hasDevices = () => data.devices.length > 0;

        return (
          <Show
            when={data.monthlyGpv.length > 0 || hasDevices()}
            fallback={
              <p class={styles.empty}>Sin datos de GPV para este comercio.</p>
            }
          >
            <div class={styles.widget}>
              {/* GPV and devices are independent facts about the merchant;
                  either can be present without the other. */}
              <Show when={data.monthlyGpv.at(-1)} keyed>
                {(latest) => (
                  <>
                    <Gauge
                      actual={latest.gpv}
                      target={data.projectedGpv}
                      caption={formatMonth(latest.month)}
                    />

                    <div class={styles.chart}>
                      <LineChart
                        points={data.monthlyGpv.map((point) => ({
                          label: point.month,
                          value: point.gpv,
                        }))}
                        target={data.projectedGpv}
                        height={160}
                      />
                    </div>
                  </>
                )}
              </Show>

              <Show when={hasDevices()}>
                <div class={styles.devices}>
                  <span class={styles.devicesTitle}>
                    Dispositivos ({data.devices.length})
                  </span>

                  <For each={data.devices}>
                    {(device) => (
                      <div class={styles.device}>
                        <span class={styles.deviceName}>
                          {device.product}
                          <Show when={device.serialNumber}>
                            <span class={styles.serial}>
                              {" "}
                              · {device.serialNumber}
                            </span>
                          </Show>
                        </span>

                        <span class={styles.deviceGpv}>
                          {device.m0Plus15dGpv != null
                            ? formatSolesCompact(device.m0Plus15dGpv)
                            : null}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        );
      }}
    </Show>
  );
}

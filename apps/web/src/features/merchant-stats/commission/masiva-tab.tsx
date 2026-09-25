import { Show } from "solid-js";
import type { StoreSetter } from "solid-js";

import { SettingsOptionCardCounterRow } from "~/components/settings/settings-option-card";
import {
  defaultMassMarketCaja1Rules,
  defaultMassMarketCaja2Rules,
  defaultPenalidadReversionRules,
  type CommissionSchemeRules,
} from "~/domain/merchant-stats/commission";

import {
  BandTableRow,
  ConfigurableSection,
  createSectionSetter,
  NumberField,
  PercentField,
} from "./fields";

export function MasivaTab(props: {
  draft: CommissionSchemeRules;
  setDraft: StoreSetter<CommissionSchemeRules>;
}) {
  const setCaja1 = createSectionSetter(
    () => props.setDraft,
    (draft) => draft.massMarket.caja1,
  );
  const setCaja2 = createSectionSetter(
    () => props.setDraft,
    (draft) => draft.massMarket.caja2,
  );
  const setReversion = createSectionSetter(
    () => props.setDraft,
    (draft) => draft.penalidadReversion.massMarket,
  );

  return (
    <>
      <ConfigurableSection
        title="Caja 1"
        description="Activación en M0 y rangos de pago a M0+15."
        toggleAriaLabel="Caja 1, mesa 2 y 3 (masiva)"
        enabled={props.draft.massMarket.caja1 !== null}
        onToggle={(enabled) =>
          props.setDraft((draft) => {
            draft.massMarket.caja1 = enabled
              ? defaultMassMarketCaja1Rules()
              : null;
          })
        }
      >
        <Show when={props.draft.massMarket.caja1}>
          {(caja1) => (
            <>
              <NumberField
                label="GPV mínimo (M0)"
                description="Más de este monto en soles."
                value={caja1().activation.minGpv}
                onChange={(minGpv) =>
                  setCaja1((rules) => {
                    rules.activation.minGpv = minGpv;
                  })
                }
              />

              <SettingsOptionCardCounterRow
                title="Transacciones mínimas (M0)"
                ariaLabel="Transacciones mínimas"
                value={caja1().activation.minTrx}
                min={0}
                max={20}
                onChange={(minTrx) =>
                  setCaja1((rules) => {
                    rules.activation.minTrx = minTrx;
                  })
                }
              />

              <SettingsOptionCardCounterRow
                title="Meta de activas en M0"
                value={caja1().m0Target}
                min={0}
                max={200}
                onChange={(m0Target) =>
                  setCaja1((rules) => {
                    rules.m0Target = m0Target;
                  })
                }
              />

              <BandTableRow
                label="Rangos de pago (activas en M0+15)"
                bands={caja1().m0Plus15Bands}
                onChange={(m0Plus15Bands) =>
                  setCaja1((rules) => {
                    rules.m0Plus15Bands = m0Plus15Bands;
                  })
                }
              />
            </>
          )}
        </Show>
      </ConfigurableSection>

      <ConfigurableSection
        title="Caja 2"
        description="Rangos de pago por volumen de POS activo, en M0+M1 y M2."
        toggleAriaLabel="Caja 2, mesa 2 y 3 (masiva)"
        enabled={props.draft.massMarket.caja2 !== null}
        onToggle={(enabled) =>
          props.setDraft((draft) => {
            draft.massMarket.caja2 = enabled
              ? defaultMassMarketCaja2Rules()
              : null;
          })
        }
      >
        <Show when={props.draft.massMarket.caja2}>
          {(caja2) => (
            <>
              <NumberField
                label="GPV mínimo por POS activo"
                value={caja2().activePosMinGpv}
                onChange={(activePosMinGpv) =>
                  setCaja2((rules) => {
                    rules.activePosMinGpv = activePosMinGpv;
                  })
                }
              />

              <BandTableRow
                label="Rangos de pago (M0+M1)"
                bands={caja2().bandsM0PlusM1}
                onChange={(bandsM0PlusM1) =>
                  setCaja2((rules) => {
                    rules.bandsM0PlusM1 = bandsM0PlusM1;
                  })
                }
              />

              <BandTableRow
                label="Rangos de pago (M2)"
                bands={caja2().bandsM2}
                onChange={(bandsM2) =>
                  setCaja2((rules) => {
                    rules.bandsM2 = bandsM2;
                  })
                }
              />
            </>
          )}
        </Show>
      </ConfigurableSection>

      <ConfigurableSection
        title="Penalidad de reversión"
        description="Si un POS comisionó en M0+M1 pero no llega al mínimo en M2."
        toggleAriaLabel="Penalidad de reversión, mesa 2 y 3 (masiva)"
        enabled={props.draft.penalidadReversion.massMarket !== null}
        onToggle={(enabled) =>
          props.setDraft((draft) => {
            draft.penalidadReversion.massMarket = enabled
              ? defaultPenalidadReversionRules()
              : null;
          })
        }
      >
        <Show when={props.draft.penalidadReversion.massMarket}>
          {(reversion) => (
            <>
              <NumberField
                label="GPV mínimo en M2"
                value={reversion().minM2Gpv}
                onChange={(minM2Gpv) =>
                  setReversion((rules) => {
                    rules.minM2Gpv = minM2Gpv;
                  })
                }
              />

              <PercentField
                label="Porcentaje de reversión"
                value={reversion().reversalPct}
                onChange={(reversalPct) =>
                  setReversion((rules) => {
                    rules.reversalPct = reversalPct;
                  })
                }
              />
            </>
          )}
        </Show>
      </ConfigurableSection>
    </>
  );
}

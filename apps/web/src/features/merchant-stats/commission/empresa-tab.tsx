import { Show } from "solid-js";
import type { StoreSetter } from "solid-js";

import {
  defaultCompanyCaja3Rules,
  defaultExecutiveActivationBarRules,
  defaultPenalidadActivacionRules,
  type CommissionSchemeRules,
} from "~/domain/merchant-stats/commission";

import {
  ConfigurableSection,
  createSectionSetter,
  MesaCumulativeGpvRow,
  NumberField,
  PercentField,
} from "./fields";

export function EmpresaTab(props: {
  draft: CommissionSchemeRules;
  setDraft: StoreSetter<CommissionSchemeRules>;
}) {
  const setCaja3 = createSectionSetter(
    () => props.setDraft,
    (draft) => draft.company.caja3,
  );
  const setActivacion = createSectionSetter(
    () => props.setDraft,
    (draft) => draft.penalidadActivacion,
  );
  const setActivationBar = createSectionSetter(
    () => props.setDraft,
    (draft) => draft.executiveActivationBar,
  );

  return (
    <>
      <ConfigurableSection
        title="Caja 3"
        description="Meta única de GPV, todas las mesas y productos, M0+M1+M2."
        enabled={props.draft.company.caja3 !== null}
        onToggle={(enabled) =>
          props.setDraft((draft) => {
            draft.company.caja3 = enabled ? defaultCompanyCaja3Rules() : null;
          })
        }
      >
        <Show when={props.draft.company.caja3}>
          {(caja3) => (
            <NumberField
              label="Meta de GPV"
              value={caja3().targetGpv}
              onChange={(targetGpv) =>
                setCaja3((rules) => {
                  rules.targetGpv = targetGpv;
                })
              }
            />
          )}
        </Show>
      </ConfigurableSection>

      <ConfigurableSection
        title="Penalidad de activación"
        description="Las ventas no activadas en acumulado (M0+M1+M2) deben ser menos del 10% de la empresa."
        enabled={props.draft.penalidadActivacion !== null}
        onToggle={(enabled) =>
          props.setDraft((draft) => {
            draft.penalidadActivacion = enabled
              ? defaultPenalidadActivacionRules()
              : null;
          })
        }
      >
        <Show when={props.draft.penalidadActivacion}>
          {(activacion) => (
            <>
              <MesaCumulativeGpvRow
                value={activacion().minCumulativeGpvByMesa}
                onChange={(minCumulativeGpvByMesa) =>
                  setActivacion((rules) => {
                    rules.minCumulativeGpvByMesa = minCumulativeGpvByMesa;
                  })
                }
              />

              <PercentField
                label="Porcentaje máximo de inactivas"
                description="Estrictamente menor a este porcentaje."
                value={activacion().maxInactiveRate}
                onChange={(maxInactiveRate) =>
                  setActivacion((rules) => {
                    rules.maxInactiveRate = maxInactiveRate;
                  })
                }
              />
            </>
          )}
        </Show>
      </ConfigurableSection>

      <ConfigurableSection
        title="Activación de ejecutivos"
        description="Umbral uniforme que exige Infinity Pay, distinto del criterio real de Culqi."
        enabled={props.draft.executiveActivationBar !== null}
        onToggle={(enabled) =>
          props.setDraft((draft) => {
            draft.executiveActivationBar = enabled
              ? defaultExecutiveActivationBarRules()
              : null;
          })
        }
      >
        <Show when={props.draft.executiveActivationBar}>
          {(bar) => (
            <NumberField
              label="GPV mínimo por venta"
              value={bar().minGpvPerSale}
              onChange={(minGpvPerSale) =>
                setActivationBar((rules) => {
                  rules.minGpvPerSale = minGpvPerSale;
                })
              }
            />
          )}
        </Show>
      </ConfigurableSection>
    </>
  );
}

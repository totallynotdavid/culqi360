import { Show } from "solid-js";
import type { StoreSetter } from "solid-js";

import { SettingsOptionCardCounterRow } from "~/components/settings/settings-option-card";
import {
  defaultCorporateCaja2Rules,
  type CommissionSchemeRules,
} from "~/domain/merchant-stats/commission";

import { ConfigurableSection, NumberField, PendingSection } from "./fields";

export function CorporativaTab(props: {
  draft: CommissionSchemeRules;
  setDraft: StoreSetter<CommissionSchemeRules>;
}) {
  return (
    <>
      <PendingSection
        title="Caja 1"
        description="El criterio de activación para mesa 1 (corporativa) todavía no está definido."
      />

      <ConfigurableSection
        title="Caja 2"
        description="Por usuario: suma de RUCs calificados vs. dos criterios."
        toggleAriaLabel="Caja 2, mesa 1 (corporativa)"
        enabled={props.draft.corporate.caja2 !== null}
        onToggle={(enabled) =>
          props.setDraft(
            "corporate",
            "caja2",
            enabled ? defaultCorporateCaja2Rules() : null,
          )
        }
      >
        <Show when={props.draft.corporate.caja2}>
          {(caja2) => (
            <>
              <NumberField
                label="GPV mínimo por RUC activo"
                value={caja2().activeRucMinGpv}
                onChange={(activeRucMinGpv) =>
                  props.setDraft("corporate", "caja2", {
                    ...caja2(),
                    activeRucMinGpv,
                  })
                }
              />

              <NumberField
                label="Suma mínima de RUCs calificados"
                value={caja2().minAggregateGpv}
                onChange={(minAggregateGpv) =>
                  props.setDraft("corporate", "caja2", {
                    ...caja2(),
                    minAggregateGpv,
                  })
                }
              />

              <SettingsOptionCardCounterRow
                title="Mínimo de RUCs calificados"
                value={caja2().minQualifyingRucs}
                min={0}
                max={10}
                onChange={(minQualifyingRucs) =>
                  props.setDraft("corporate", "caja2", {
                    ...caja2(),
                    minQualifyingRucs,
                  })
                }
              />
            </>
          )}
        </Show>
      </ConfigurableSection>

      <PendingSection
        title="Penalidad de reversión"
        description="Existe una penalidad de reversión para mesa 1 (corporativa), pero su cálculo todavía no está definido."
      />
    </>
  );
}

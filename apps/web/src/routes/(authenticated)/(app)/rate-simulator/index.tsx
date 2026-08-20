import { createSignal, For, Show } from "solid-js";

import {
  AppPage,
  AppPageSection,
  AppPageSectionTitle,
} from "~/components/layout/page";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import {
  asSummaryTable,
  calculateRates,
  type Medio,
  type RatesInput,
  type SummaryTable,
} from "~/features/rate-simulator/model/calculator";

import styles from "./rate-simulator-page.module.css";

const MEDIOS = [
  "debito",
  "credito",
  "foranea",
] as const satisfies ReadonlyArray<Medio>;

const MEDIO_LABEL: Record<Medio, string> = {
  debito: "Débito",
  credito: "Crédito",
  foranea: "Foránea",
};

const DEFAULT_INPUT: RatesInput = {
  mix: {
    debito: "40",
    credito: "59",
    foranea: "1",
  },
  currentRates: {
    debito: "3.2",
    credito: "3.2",
    foranea: "4.09",
  },
  proposalRates: {
    debito: "2.7",
    credito: "2.7",
    foranea: "3.99",
  },
};

function valueFor(
  state: RatesInput,
  section: keyof RatesInput,
  medio: Medio,
): string {
  return state[section][medio];
}

export default function RateSimulatorPage() {
  const [form, setForm] = createSignal(DEFAULT_INPUT);
  const [summary, setSummary] = createSignal<SummaryTable | null>(null);
  const [calculationErrorMessage, setCalculationErrorMessage] = createSignal<
    string | null
  >(null);

  const updateField = (
    section: keyof RatesInput,
    medio: Medio,
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [medio]: value,
      },
    }));
  };

  const calculate = (event: SubmitEvent) => {
    event.preventDefault();

    const result = calculateRates(form());
    if (!result.ok) {
      setSummary(null);
      setCalculationErrorMessage(result.error);
      return;
    }

    setCalculationErrorMessage(null);
    setSummary(asSummaryTable(result.value));
  };

  return (
    <AppPage width="medium" class={styles.page}>
      <AppPageSection>
        <AppPageSectionTitle
          title="Simulador de tasas"
          description="Ingresa mezcla y tasas en porcentaje para mostrar escenario antes y después de IGV."
        />
      </AppPageSection>

      <AppPageSection>
        <form class={styles.form} onSubmit={calculate}>
          <div class={styles.inputGrid}>
            <section class={styles.card}>
              <h3 class={styles.cardTitle}>Mix (%)</h3>
              <For each={MEDIOS}>
                {(medio) => (
                  <Input
                    label={MEDIO_LABEL[medio]}
                    inputmode="decimal"
                    value={valueFor(form(), "mix", medio)}
                    onInput={(event) =>
                      updateField("mix", medio, event.currentTarget.value)
                    }
                    required
                  />
                )}
              </For>
            </section>

            <section class={styles.card}>
              <h3 class={styles.cardTitle}>Tasa competencia (%)</h3>
              <For each={MEDIOS}>
                {(medio) => (
                  <Input
                    label={MEDIO_LABEL[medio]}
                    inputmode="decimal"
                    value={valueFor(form(), "currentRates", medio)}
                    onInput={(event) =>
                      updateField(
                        "currentRates",
                        medio,
                        event.currentTarget.value,
                      )
                    }
                    required
                  />
                )}
              </For>
            </section>

            <section class={styles.card}>
              <h3 class={styles.cardTitle}>Tasa propuesta Culqi (%)</h3>
              <For each={MEDIOS}>
                {(medio) => (
                  <Input
                    label={MEDIO_LABEL[medio]}
                    inputmode="decimal"
                    value={valueFor(form(), "proposalRates", medio)}
                    onInput={(event) =>
                      updateField(
                        "proposalRates",
                        medio,
                        event.currentTarget.value,
                      )
                    }
                    required
                  />
                )}
              </For>
            </section>
          </div>

          <div class={styles.actions}>
            <Button type="submit">Calcular</Button>
            <Show when={calculationErrorMessage()}>
              {(message) => <p class={styles.errorText}>{message()}</p>}
            </Show>
          </div>
        </form>
      </AppPageSection>

      <Show when={summary()}>
        {(table) => (
          <AppPageSection>
            <AppPageSectionTitle
              title="Resumen"
              description="Comparativo para presentar al cliente potencial."
            />
            <div class={styles.tableWrap}>
              <table class={styles.table}>
                <thead>
                  <tr>
                    <th>Escenario</th>
                    <th>Antes de IGV</th>
                    <th>Después de IGV</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Competencia</td>
                    <td>{table().COMPETENCIA["ANTES DE IGV"]}</td>
                    <td>{table().COMPETENCIA["DESPUES DE IGV"]}</td>
                  </tr>
                  <tr>
                    <td>Culqi</td>
                    <td>{table().CULQI["ANTES DE IGV"]}</td>
                    <td>{table().CULQI["DESPUES DE IGV"]}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </AppPageSection>
        )}
      </Show>
    </AppPage>
  );
}

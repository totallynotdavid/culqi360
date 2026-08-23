import { type JSX } from "@solidjs/web";
import { Show, type StoreSetter } from "solid-js";

import {
  BandTableField,
  parseNumber,
} from "~/components/settings/band-table-field";
import {
  SettingsOptionCard,
  SettingsOptionCardRow,
  SettingsOptionCardToggleRow,
  SettingsOptionCardWideRow,
} from "~/components/settings/settings-option-card";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Badge } from "~/components/ui/display/badge";
import { TextInput } from "~/components/ui/input/text-input";
import type {
  PayoutBand,
  PenalidadActivacionRules,
} from "~/domain/merchant-stats/commission";

import styles from "./fields.module.css";

/**
 * Scopes a draft setter to one optional section of the scheme.
 *
 * Each section renders behind a `ConfigurableSection`, so it is always present
 * when one of its fields fires. The setter callback runs after that check
 * though, so without this the narrowing has to be re-asserted at every single
 * field. Skipping the mutation when the section is gone is the honest reading
 * of "the user turned this section off mid-edit".
 */
export function createSectionSetter<
  TDraft extends object,
  TSection extends object,
>(
  setDraft: () => StoreSetter<TDraft>,
  select: (draft: TDraft) => TSection | null,
): (mutate: (section: TSection) => void) => void {
  return (mutate) =>
    setDraft()((draft) => {
      const section = select(draft);

      if (section) {
        mutate(section);
      }
    });
}

export function NumberField(props: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <SettingsOptionCardRow
      title={props.label}
      description={props.description}
      control={
        <TextInput
          type="number"
          sizeVariant="sm"
          aria-label={props.label}
          value={String(props.value)}
          onChange={(value) => props.onChange(parseNumber(value))}
        />
      }
    />
  );
}

export function PercentField(props: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <SettingsOptionCardRow
      title={props.label}
      description={props.description}
      control={
        <TextInput
          type="number"
          sizeVariant="sm"
          aria-label={props.label}
          value={String(Math.round(props.value * 100))}
          onChange={(value) => props.onChange(parseNumber(value) / 100)}
        />
      }
    />
  );
}

export function BandTableRow(props: {
  label: string;
  bands: PayoutBand[];
  onChange: (bands: PayoutBand[]) => void;
}) {
  return (
    <SettingsOptionCardWideRow title={props.label}>
      <BandTableField bands={props.bands} onChange={props.onChange} />
    </SettingsOptionCardWideRow>
  );
}

export function MesaCumulativeGpvRow(props: {
  value: PenalidadActivacionRules["minCumulativeGpvByMesa"];
  onChange: (value: PenalidadActivacionRules["minCumulativeGpvByMesa"]) => void;
}) {
  return (
    <SettingsOptionCardWideRow title="GPV mínimo acumulado por mesa">
      <div class={styles.mesaGrid}>
        <div class={styles.mesaHeader}>
          <span>Mesa 1</span>
          <span>Mesa 2</span>
          <span>Mesa 3</span>
        </div>

        <div class={styles.mesaRow}>
          <TextInput
            type="number"
            sizeVariant="sm"
            aria-label="GPV mínimo acumulado, mesa 1"
            value={String(props.value.mesa1)}
            onChange={(value) =>
              props.onChange({ ...props.value, mesa1: parseNumber(value) })
            }
          />

          <TextInput
            type="number"
            sizeVariant="sm"
            aria-label="GPV mínimo acumulado, mesa 2"
            value={String(props.value.mesa2)}
            onChange={(value) =>
              props.onChange({ ...props.value, mesa2: parseNumber(value) })
            }
          />

          <TextInput
            type="number"
            sizeVariant="sm"
            aria-label="GPV mínimo acumulado, mesa 3"
            value={String(props.value.mesa3)}
            onChange={(value) =>
              props.onChange({ ...props.value, mesa3: parseNumber(value) })
            }
          />
        </div>
      </div>
    </SettingsOptionCardWideRow>
  );
}

export function ConfigurableSection(props: {
  title: string;
  description?: string;
  toggleAriaLabel?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: JSX.Element;
}) {
  return (
    <SettingsSection title={props.title} description={props.description}>
      <SettingsOptionCard>
        <SettingsOptionCardToggleRow
          interactive
          title="Configurado"
          description="Empieza con los umbrales confirmados; desactívalo si no corresponde calcular esta caja."
          ariaLabel={`Configurar ${props.toggleAriaLabel ?? props.title}`}
          value={props.enabled}
          onChange={props.onToggle}
        />

        <Show when={props.enabled}>{props.children}</Show>
      </SettingsOptionCard>
    </SettingsSection>
  );
}

export function PendingSection(props: { title: string; description: string }) {
  return (
    <SettingsSection
      title={props.title}
      description={props.description}
      actions={<Badge variant="secondary">Pendiente de definir</Badge>}
    />
  );
}

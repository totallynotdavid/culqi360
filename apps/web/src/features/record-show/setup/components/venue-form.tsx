import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";

import BrowserMaximize from "~/components/icons/browser-maximize";
import Building2 from "~/components/icons/building-2";
import LinkIcon from "~/components/icons/link";
import MapIcon from "~/components/icons/map";
import Package from "~/components/icons/package";
import { Button } from "~/components/ui/input/button";
import { Radio, RadioGroup } from "~/components/ui/input/radio";
import { TextInput } from "~/components/ui/input/text-input";
import {
  COLLECTION_MODES,
  type CollectionMode,
  type ProductScope,
} from "~/contracts/workflow/vocabulary";
import {
  FieldInputValue,
  FieldRow,
  FieldTable,
} from "~/features/widgets/field-table";
import {
  WidgetCardActions,
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";

import type { VenueFormState } from "../model/venue-form-state";

import styles from "./venue-form.module.css";

const MODALIDAD_COBRO_LABELS: Record<CollectionMode, string> = {
  SUSCRIPCIONES: "Suscripciones",
  ONE_CLIC: "One Click",
  CARGO_UNICO: "Cargo único",
};

function TextFieldRow(props: {
  label: string;
  icon: (props: { size?: number }) => JSX.Element;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "url";
  min?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <FieldRow label={props.label} icon={props.icon}>
      <FieldInputValue>
        <TextInput
          sizeVariant="sm"
          type={props.type}
          min={props.min}
          step={props.step}
          value={props.value}
          onChange={props.onChange}
          required={props.required}
        />
      </FieldInputValue>
    </FieldRow>
  );
}

export function VenueForm(props: {
  title: string;
  submitLabel: string;
  form: VenueFormState;
  linkScope: ProductScope;
  onlineScope: ProductScope;
  submitting: boolean;
  errorMessage: string | null;
  secondaryAction?: JSX.Element;
  onSubmit: (event: SubmitEvent) => void;
}) {
  return (
    <WidgetCard>
      <WidgetCardHeader>
        <WidgetCardTitle text={props.title} />
      </WidgetCardHeader>

      <WidgetCardContent>
        <form onSubmit={props.onSubmit}>
          <FieldTable>
            <TextFieldRow
              label="Nombre comercial"
              icon={Building2}
              value={props.form.tradeName()}
              onChange={props.form.setTradeName}
              required
            />

            <TextFieldRow
              label="Cantidad POS"
              icon={Package}
              type="number"
              min="1"
              step="1"
              value={props.form.posQuantity()}
              onChange={props.form.setPosQuantity}
              required
            />

            <TextFieldRow
              label="Dirección"
              icon={MapIcon}
              value={props.form.address()}
              onChange={props.form.setAddress}
              required
            />

            <TextFieldRow
              label="Referencia"
              icon={MapIcon}
              value={props.form.addressReference()}
              onChange={props.form.setAddressReference}
              required
            />

            <TextFieldRow
              label="Distrito"
              icon={MapIcon}
              value={props.form.district()}
              onChange={props.form.setDistrict}
              required
            />

            <TextFieldRow
              label="Provincia"
              icon={MapIcon}
              value={props.form.province()}
              onChange={props.form.setProvince}
              required
            />

            <TextFieldRow
              label="Departamento"
              icon={MapIcon}
              value={props.form.department()}
              onChange={props.form.setDepartment}
              required
            />

            <Show when={props.linkScope === "per_venue"}>
              <TextFieldRow
                label="URL Culqi Link"
                icon={LinkIcon}
                type="url"
                value={props.form.linkUrl()}
                onChange={props.form.setLinkUrl}
                required
              />
            </Show>

            <Show when={props.onlineScope === "per_venue"}>
              <TextFieldRow
                label="URL Culqi Online"
                icon={BrowserMaximize}
                type="url"
                value={props.form.onlineUrl()}
                onChange={props.form.setOnlineUrl}
                required
              />

              <FieldRow label="Modalidad de cobro" icon={Package}>
                <FieldInputValue>
                  <RadioGroup>
                    <For each={COLLECTION_MODES}>
                      {(value) => (
                        <Radio
                          name="onlineCollectionMode"
                          value={value}
                          label={MODALIDAD_COBRO_LABELS[value]}
                          checked={props.form.onlineCollectionMode() === value}
                          onChange={() =>
                            props.form.setOnlineCollectionMode(value)
                          }
                        />
                      )}
                    </For>
                  </RadioGroup>
                </FieldInputValue>
              </FieldRow>
            </Show>
          </FieldTable>

          <Show when={props.errorMessage}>
            {(message) => <p class={styles.error}>{message()}</p>}
          </Show>

          <WidgetCardActions>
            {props.secondaryAction}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={props.submitting}
            >
              {props.submitLabel}
            </Button>
          </WidgetCardActions>
        </form>
      </WidgetCardContent>
    </WidgetCard>
  );
}

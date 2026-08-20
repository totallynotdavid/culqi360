import { type JSX } from "@solidjs/web";
import { For, Show } from "solid-js";

import Moneybag from "~/components/icons/moneybag";
import Package from "~/components/icons/package";
import { Button } from "~/components/ui/input/button";
import { Radio, RadioGroup } from "~/components/ui/input/radio";
import { TextInput } from "~/components/ui/input/text-input";
import { Toggle } from "~/components/ui/input/toggle";
import { BankPicker } from "~/components/ui/pickers/bank-picker";
import { ACCOUNT_TYPE_KINDS } from "~/contracts/workflow/vocabulary";
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

import type { AccountsFormState } from "../model/accounts-form-state";

import styles from "./accounts-form.module.css";

function FormFieldRow(props: {
  label: string;
  icon: (props: { size?: number }) => JSX.Element;
  children: JSX.Element;
}) {
  return (
    <FieldRow label={props.label} icon={props.icon}>
      <FieldInputValue>{props.children}</FieldInputValue>
    </FieldRow>
  );
}

function BankPickerRow(props: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (bank: string) => void;
  onClose: () => void;
}) {
  return (
    <FormFieldRow label={props.label} icon={Moneybag}>
      <button
        type="button"
        class={styles.pickerTrigger}
        onClick={props.onToggle}
      >
        {props.value || "Seleccionar"}
      </button>
      <Show when={props.open}>
        <BankPicker onSelect={props.onSelect} onClose={props.onClose} />
      </Show>
    </FormFieldRow>
  );
}

export function AccountsForm(props: {
  venueName: string;
  form: AccountsFormState;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (event: SubmitEvent) => void;
}) {
  const { form } = props;

  return (
    <WidgetCard>
      <WidgetCardHeader>
        <WidgetCardTitle text={`Cuentas: ${props.venueName}`} />
      </WidgetCardHeader>
      <WidgetCardContent>
        <form onSubmit={props.onSubmit}>
          <FieldTable>
            <BankPickerRow
              label="Banco SOLES"
              value={form.bancoSoles()}
              open={form.showBancoSolesPicker()}
              onToggle={() =>
                form.setShowBancoSolesPicker(!form.showBancoSolesPicker())
              }
              onSelect={form.setBancoSoles}
              onClose={() => form.setShowBancoSolesPicker(false)}
            />

            <FormFieldRow label="Tipo cuenta SOLES" icon={Package}>
              <RadioGroup>
                <For each={ACCOUNT_TYPE_KINDS}>
                  {(kind) => (
                    <Radio
                      name="tipoCuentaSoles"
                      label={kind}
                      checked={form.tipoCuentaSoles() === kind}
                      onChange={() => form.setTipoCuentaSoles(kind)}
                    />
                  )}
                </For>
              </RadioGroup>
            </FormFieldRow>

            <FormFieldRow label="Nro cuenta SOLES" icon={Package}>
              <TextInput
                sizeVariant="sm"
                value={form.nroCuentaSoles()}
                onChange={form.setNroCuentaSoles}
                required
              />
            </FormFieldRow>

            <Show when={form.requiresCciSoles()}>
              <FormFieldRow label="CCI SOLES" icon={Package}>
                <TextInput
                  sizeVariant="sm"
                  value={form.cciSoles()}
                  onChange={form.setCciSoles}
                  required={form.requiresCciSoles()}
                />
              </FormFieldRow>
            </Show>

            <FormFieldRow label="Cuenta en dólares" icon={Moneybag}>
              <Toggle
                ariaLabel="Cuenta en dólares"
                value={form.usarDolares()}
                onChange={(checked) => {
                  form.setUsarDolares(checked);
                  if (!checked) {
                    form.setSettlementCurrency("PEN");
                  }
                }}
              />
            </FormFieldRow>

            <Show when={form.usarDolares()}>
              <BankPickerRow
                label="Banco USD"
                value={form.bancoDolares()}
                open={form.showBancoDolaresPicker()}
                onToggle={() =>
                  form.setShowBancoDolaresPicker(!form.showBancoDolaresPicker())
                }
                onSelect={form.setBancoDolares}
                onClose={() => form.setShowBancoDolaresPicker(false)}
              />

              <FormFieldRow label="Tipo cuenta USD" icon={Package}>
                <RadioGroup>
                  <For each={ACCOUNT_TYPE_KINDS}>
                    {(kind) => (
                      <Radio
                        name="tipoCuentaDolares"
                        label={kind}
                        checked={form.tipoCuentaDolares() === kind}
                        onChange={() => form.setTipoCuentaDolares(kind)}
                      />
                    )}
                  </For>
                </RadioGroup>
              </FormFieldRow>

              <FormFieldRow label="Nro cuenta USD" icon={Package}>
                <TextInput
                  sizeVariant="sm"
                  value={form.nroCuentaDolares()}
                  onChange={form.setNroCuentaDolares}
                  required={form.usarDolares()}
                />
              </FormFieldRow>

              <Show when={form.requiresCciDolares()}>
                <FormFieldRow label="CCI USD" icon={Package}>
                  <TextInput
                    sizeVariant="sm"
                    value={form.cciDolares()}
                    onChange={form.setCciDolares}
                    required={form.requiresCciDolares()}
                  />
                </FormFieldRow>
              </Show>
            </Show>

            <FormFieldRow label="Cuenta de abono" icon={Moneybag}>
              <RadioGroup>
                <Radio
                  name="settlementCurrency"
                  label="SOLES"
                  checked={form.settlementCurrency() === "PEN"}
                  onChange={() => form.setSettlementCurrency("PEN")}
                />
                <Show when={form.usarDolares()}>
                  <Radio
                    name="settlementCurrency"
                    label="USD"
                    checked={form.settlementCurrency() === "USD"}
                    onChange={() => form.setSettlementCurrency("USD")}
                  />
                </Show>
              </RadioGroup>
            </FormFieldRow>
          </FieldTable>

          <Show when={props.errorMessage}>
            {(message) => <p class={styles.error}>{message()}</p>}
          </Show>

          <WidgetCardActions>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={props.submitting}
            >
              Guardar cuentas
            </Button>
          </WidgetCardActions>
        </form>
      </WidgetCardContent>
    </WidgetCard>
  );
}

import { useAction } from "@solidjs/router";
import type { JSX } from "@solidjs/web";

import Building2 from "~/components/icons/building-2";
import Moneybag from "~/components/icons/moneybag";
import Package from "~/components/icons/package";
import Target from "~/components/icons/target";
import {
  InlineFieldEditor,
  InlineOptionsEditor,
} from "~/components/ui/input/inline-field-editor";
import { actionErrorMessage } from "~/contracts/errors";
import type { CommercialScope } from "~/contracts/workflow/inputs";
import { MIN_GPV } from "~/contracts/workflow/limits";
import type { LeadDetailView } from "~/contracts/workflow/views";
import { SETTLEMENT_BANKS } from "~/contracts/workflow/vocabulary";
import {
  FieldTextValue,
  RecordInlineCell,
} from "~/features/widgets/field-table";
import { editCommercialScopeMutation } from "~/features/workflow/data/command-mutations";
import { revalidateWorkflowLead } from "~/features/workflow/data/revalidate-workflow";
import {
  formatAmount,
  formatRate,
} from "~/features/workflow/presentation/format";

type InlineEdit = {
  ariaLabel: string;
  renderEditor: (onClose: () => void) => JSX.Element;
};

export function CommercialFields(props: { data: LeadDetailView }) {
  const save = useAction(editCommercialScopeMutation);

  const canEdit = () =>
    props.data.availableActions.includes("edit-commercial-scope");
  const profile = () => props.data.profile;

  async function submitField(patch: Partial<CommercialScope>) {
    const current = profile();
    try {
      await save({
        leadId: props.data.lead.id,
        currentProvider: current.currentProvider,
        currentDebitRate: current.currentDebitRate,
        currentCreditRate: current.currentCreditRate,
        gpv: current.gpv,
        ticket: current.ticket,
        lineOfBusiness: current.lineOfBusiness ?? "",
        settlementBank: current.settlementBank,
        posCount: current.posCount,
        ...patch,
      });
      revalidateWorkflowLead(props.data.lead.id);
    } catch (caught) {
      throw new Error(actionErrorMessage(caught), { cause: caught });
    }
  }

  function numberEdit(
    label: string,
    current: number,
    toPatch: (value: number) => Partial<CommercialScope>,
    step: string,
    min = "0",
  ): InlineEdit | undefined {
    if (!canEdit()) {
      return undefined;
    }
    return {
      ariaLabel: `Editar ${label}`,
      renderEditor: (onClose) => (
        <InlineFieldEditor
          initialValue={String(current)}
          ariaLabel={label}
          type="number"
          step={step}
          min={min}
          onSubmit={(value) => submitField(toPatch(Number(value)))}
          onClose={onClose}
        />
      ),
    };
  }

  function textEdit(
    label: string,
    current: string,
    toPatch: (value: string) => Partial<CommercialScope>,
  ): InlineEdit | undefined {
    if (!canEdit()) {
      return undefined;
    }
    return {
      ariaLabel: `Editar ${label}`,
      renderEditor: (onClose) => (
        <InlineFieldEditor
          initialValue={current}
          ariaLabel={label}
          type="text"
          onSubmit={(value) => submitField(toPatch(value.trim()))}
          onClose={onClose}
        />
      ),
    };
  }

  function bankEdit(): InlineEdit | undefined {
    if (!canEdit()) {
      return undefined;
    }
    return {
      ariaLabel: "Editar Banco de abono",
      renderEditor: (onClose) => (
        <InlineOptionsEditor
          options={SETTLEMENT_BANKS}
          selected={profile().settlementBank}
          ariaLabel="Banco de abono"
          onSubmit={(value) => submitField({ settlementBank: value })}
          onClose={onClose}
        />
      ),
    };
  }

  return (
    <>
      <RecordInlineCell
        label="Proveedor actual"
        icon={Building2}
        edit={textEdit(
          "Proveedor actual",
          profile().currentProvider,
          (value) => ({ currentProvider: value }),
        )}
      >
        <FieldTextValue>{profile().currentProvider}</FieldTextValue>
      </RecordInlineCell>

      <RecordInlineCell
        label="Tasa débito actual"
        icon={Target}
        edit={numberEdit(
          "Tasa débito actual",
          profile().currentDebitRate,
          (value) => ({ currentDebitRate: value }),
          "0.01",
        )}
      >
        <FieldTextValue>
          {formatRate(profile().currentDebitRate)}
        </FieldTextValue>
      </RecordInlineCell>

      <RecordInlineCell
        label="Tasa crédito actual"
        icon={Target}
        edit={numberEdit(
          "Tasa crédito actual",
          profile().currentCreditRate,
          (value) => ({ currentCreditRate: value }),
          "0.01",
        )}
      >
        <FieldTextValue>
          {formatRate(profile().currentCreditRate)}
        </FieldTextValue>
      </RecordInlineCell>

      <RecordInlineCell
        label="GPV"
        icon={Moneybag}
        edit={numberEdit(
          "GPV",
          profile().gpv,
          (value) => ({ gpv: value }),
          "0.01",
          String(MIN_GPV),
        )}
      >
        <FieldTextValue>{formatAmount(profile().gpv)}</FieldTextValue>
      </RecordInlineCell>

      <RecordInlineCell
        label="Ticket"
        icon={Moneybag}
        edit={numberEdit(
          "Ticket",
          profile().ticket,
          (value) => ({ ticket: value }),
          "0.01",
        )}
      >
        <FieldTextValue>{formatAmount(profile().ticket)}</FieldTextValue>
      </RecordInlineCell>

      <RecordInlineCell
        label="Giro de negocio"
        icon={Package}
        empty={!profile().lineOfBusiness}
        edit={textEdit(
          "Giro de negocio",
          profile().lineOfBusiness ?? "",
          (value) => ({ lineOfBusiness: value }),
        )}
      >
        <FieldTextValue>{profile().lineOfBusiness}</FieldTextValue>
      </RecordInlineCell>

      <RecordInlineCell
        label="Banco de abono"
        icon={Building2}
        edit={bankEdit()}
      >
        <FieldTextValue>{profile().settlementBank}</FieldTextValue>
      </RecordInlineCell>

      <RecordInlineCell
        label="Cantidad de POS"
        icon={Package}
        edit={numberEdit(
          "Cantidad de POS",
          profile().posCount,
          (value) => ({ posCount: value }),
          "1",
        )}
      >
        <FieldTextValue>{String(profile().posCount)}</FieldTextValue>
      </RecordInlineCell>
    </>
  );
}

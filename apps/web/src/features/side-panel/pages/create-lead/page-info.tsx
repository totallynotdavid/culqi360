import { onSettled } from "solid-js";

import Building2 from "~/components/icons/building-2";
import { TextInput } from "~/components/ui/input/text-input";

import { PageInfoLayout } from "../../top-bar/page-info-layout";
import { useCreateLeadPageState } from "./state";

export function CreateLeadPageInfo() {
  const { draftRuc, label, setRuc } = useCreateLeadPageState();
  let inputRef: HTMLInputElement | undefined;

  onSettled(() => {
    inputRef?.focus();
  });

  return (
    <PageInfoLayout
      icon={<Building2 size={14} />}
      title={
        <TextInput
          ref={(el) => {
            inputRef = el;
          }}
          sizeVariant="sm"
          inheritFontStyles
          value={draftRuc()}
          onChange={setRuc}
          placeholder="RUC"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength={11}
          autocomplete="off"
          aria-label="RUC"
        />
      }
      label={label()}
    />
  );
}

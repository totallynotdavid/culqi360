import type { JSX } from "@solidjs/web";
import { Show, createSignal } from "solid-js";
import type { ParentProps } from "solid-js";

import Pencil from "~/components/icons/pencil";
import { EditButtonWrapper } from "~/components/ui/input/edit-button-wrapper";
import { LightIconButton } from "~/components/ui/input/light-icon-button";
import { OverflowingText } from "~/components/ui/overflow-tooltip/overflow-tooltip";

import styles from "./field-table.module.css";

type FieldIconComponent = (props: {
  size?: number;
  class?: string;
}) => JSX.Element;

export function FieldTable(props: ParentProps) {
  return <div class={styles.fieldTable}>{props.children}</div>;
}

type FieldRowBaseProps = {
  readonly?: boolean;
  hovered?: boolean;
  onMouseEnter?: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>;
  onMouseLeave?: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>;
  onFocusIn?: JSX.EventHandlerUnion<HTMLDivElement, FocusEvent>;
  onFocusOut?: JSX.EventHandlerUnion<HTMLDivElement, FocusEvent>;
};

type FieldRowProps = ParentProps<
  FieldRowBaseProps &
    (
      | {
          label: string;
          icon: FieldIconComponent;
          labelWidth?: number;
        }
      | {
          label?: undefined;
          icon?: undefined;
          labelWidth?: undefined;
        }
    )
>;

export function FieldRow(props: FieldRowProps) {
  return (
    <div
      class={`${styles.fieldRow} ${props.readonly ? styles.fieldRowReadonly : ""} ${props.hovered ? styles.fieldRowHovered : ""}`}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      onFocusIn={props.onFocusIn}
      onFocusOut={props.onFocusOut}
    >
      {props.label ? (
        <FieldLabel
          label={props.label}
          icon={props.icon}
          width={props.labelWidth}
        />
      ) : null}
      {props.children}
    </div>
  );
}

function FieldLabel(props: {
  label: string;
  icon: FieldIconComponent;
  width?: number;
}) {
  return (
    <div class={styles.fieldLabel}>
      <div class={styles.fieldIcon}>
        <props.icon size={16} />
      </div>
      <div
        class={styles.fieldLabelText}
        style={{ width: `${props.width ?? 90}px` }}
      >
        <OverflowingText text={props.label} style={{ width: "100%" }} />
      </div>
    </div>
  );
}

function FieldValue(props: ParentProps) {
  return <div class={styles.fieldValue}>{props.children}</div>;
}

function FieldValueDisplay(props: ParentProps) {
  return <div class={styles.fieldValueDisplay}>{props.children}</div>;
}

export function FieldTextValue(props: ParentProps) {
  return <span class={styles.fieldTextValue}>{props.children}</span>;
}

export function FieldEmptyValue(props: ParentProps) {
  return <span class={styles.fieldEmptyValue}>{props.children}</span>;
}

export function FieldInputValue(props: ParentProps) {
  return <div class={styles.fieldInputValue}>{props.children}</div>;
}

type RecordInlineCellEdit = {
  ariaLabel: string;
  renderEditor: (onClose: () => void) => JSX.Element;
  onClose?: () => void;
};

export function RecordInlineCell(
  props: ParentProps<{
    label: string;
    icon: FieldIconComponent;
    empty?: boolean;
    edit?: RecordInlineCellEdit;
  }>,
) {
  const [hovered, setHovered] = createSignal(false);
  const [editing, setEditing] = createSignal(false);

  function closeEditor() {
    setEditing(false);
    props.edit?.onClose?.();
  }

  return (
    <FieldRow
      label={props.label}
      icon={props.icon}
      readonly={!props.edit}
      hovered={hovered()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusIn={() => setHovered(true)}
      onFocusOut={() => setHovered(false)}
    >
      <FieldValue>
        <FieldValueDisplay>
          <Show
            when={!props.empty}
            fallback={<FieldEmptyValue>{props.label}</FieldEmptyValue>}
          >
            {props.children}
          </Show>
        </FieldValueDisplay>
        <Show when={props.edit}>
          {(edit) => (
            <div class={styles.editWrapper}>
              <EditButtonWrapper visible={hovered()}>
                <LightIconButton
                  Icon={Pencil}
                  aria-label={edit().ariaLabel}
                  title={edit().ariaLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditing(true);
                  }}
                />
              </EditButtonWrapper>
              <Show when={editing()}>{edit().renderEditor(closeEditor)}</Show>
            </div>
          )}
        </Show>
      </FieldValue>
    </FieldRow>
  );
}

import { type JSX } from "@solidjs/web";
import { Dynamic } from "@solidjs/web";
import { clsx } from "clsx";
import { Show, type ParentProps } from "solid-js";

import { Toggle } from "~/components/ui/input/toggle";
import { OverflowingText } from "~/components/ui/overflow-tooltip/overflow-tooltip";

import { SettingsCounter } from "./settings-counter";

import styles from "./settings-option-card.module.css";

type RowIcon = (props: { size?: number; color?: string }) => JSX.Element;

function OptionText(props: {
  title: string;
  description?: string;
  Icon?: RowIcon;
}) {
  return (
    <>
      <Show when={props.Icon}>
        {(Icon) => (
          <span class={styles.icon}>
            <Dynamic component={Icon()} size={16} />
          </span>
        )}
      </Show>

      <div class={styles.text}>
        <span class={styles.title}>{props.title}</span>

        <Show when={props.description}>
          {(description) => (
            <span class={styles.description}>
              <OverflowingText text={description()} maxRows={5} />
            </span>
          )}
        </Show>
      </div>
    </>
  );
}

export function SettingsOptionCard(props: ParentProps) {
  return <div class={styles.card}>{props.children}</div>;
}

export function SettingsOptionCardRow(props: {
  title: string;
  description?: string;
  control: JSX.Element;
  interactive?: boolean;
  Icon?: RowIcon;
}) {
  return (
    <div class={clsx(styles.row, props.interactive && styles.rowInteractive)}>
      <OptionText
        title={props.title}
        description={props.description}
        Icon={props.Icon}
      />

      <span class={styles.control}>{props.control}</span>
    </div>
  );
}

export function SettingsOptionCardToggleRow(props: {
  title: string;
  description?: string;
  Icon?: RowIcon;
  interactive?: boolean;
  ariaLabel?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <SettingsOptionCardRow
      title={props.title}
      description={props.description}
      Icon={props.Icon}
      interactive={props.interactive}
      control={
        <Toggle
          ariaLabel={props.ariaLabel ?? props.title}
          value={props.value}
          disabled={props.disabled}
          onChange={props.onChange}
        />
      }
    />
  );
}

export function SettingsOptionCardCounterRow(props: {
  title: string;
  description?: string;
  Icon?: RowIcon;
  interactive?: boolean;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <SettingsOptionCardRow
      title={props.title}
      description={props.description}
      Icon={props.Icon}
      interactive={props.interactive}
      control={
        <SettingsCounter
          ariaLabel={props.ariaLabel ?? props.title}
          value={props.value}
          min={props.min}
          max={props.max}
          disabled={props.disabled}
          onChange={props.onChange}
        />
      }
    />
  );
}

export function SettingsOptionCardWideRow(
  props: ParentProps<{
    title: string;
    description?: string;
    Icon?: RowIcon;
  }>,
) {
  return (
    <div class={clsx(styles.row, styles.wideRow)}>
      <OptionText
        title={props.title}
        description={props.description}
        Icon={props.Icon}
      />

      {props.children}
    </div>
  );
}

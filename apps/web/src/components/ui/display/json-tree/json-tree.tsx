import { Dynamic } from "@solidjs/web";
import {
  createContext,
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Switch,
  useContext,
  type Component,
} from "solid-js";

import Checkbox from "~/components/icons/checkbox";
import ChevronDown from "~/components/icons/chevron-down";
import CircleAlert from "~/components/icons/circle-alert";
import List from "~/components/icons/list";
import MessageSquare from "~/components/icons/message-square";
import Package from "~/components/icons/package";
import Point from "~/components/icons/point";
import type { Json } from "~/contracts/json";

import styles from "./json-tree.module.css";

type IconComponent = Component<{ size?: number; color?: string }>;
type ShouldExpand = (params: { keyPath: string; depth: number }) => boolean;
type Entry = { id: string; value: Json };
type JsonNodeModel =
  | { kind: "null" }
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "boolean"; value: boolean }
  | { kind: "array"; entries: Entry[] }
  | { kind: "object"; entries: Entry[] };
type JsonTreeConfig = {
  readonly shouldExpandNodeInitially: ShouldExpand;
  readonly emptyArrayLabel: string;
  readonly emptyObjectLabel: string;
  readonly emptyStringLabel: string;
  readonly onNodeValueClick: ((valueAsString: string) => void) | undefined;
};

const JsonTreeConfigContext = createContext<JsonTreeConfig>();

function useConfig(): JsonTreeConfig {
  const config = useContext(JsonTreeConfigContext);
  if (!config) {
    throw new Error("JsonTree node rendered outside JsonTree");
  }
  return config;
}

function toNodeModel(value: Json): JsonNodeModel {
  if (value === null) {
    return { kind: "null" };
  }
  if (typeof value === "string") {
    return { kind: "string", value };
  }
  if (typeof value === "number") {
    return { kind: "number", value };
  }
  if (typeof value === "boolean") {
    return { kind: "boolean", value };
  }
  if (Array.isArray(value)) {
    return {
      kind: "array",
      entries: value.map((entry, index) => ({
        id: String(index),
        value: entry,
      })),
    };
  }
  return {
    kind: "object",
    entries: Object.entries(value).map(([id, entry]) => ({ id, value: entry })),
  };
}

function NodeLabel(props: { label: string; icon: IconComponent }) {
  return (
    <span class={styles.labelContainer}>
      <Dynamic component={props.icon} size={16} />
      <span>{props.label}</span>
    </span>
  );
}

function NodeValue(props: { valueAsString: string }) {
  const config = useConfig();
  return (
    <Show
      when={config.onNodeValueClick}
      fallback={<span class={styles.value}>{props.valueAsString}</span>}
    >
      {(copy) => (
        <button
          type="button"
          class={styles.value}
          onClick={() => copy()(props.valueAsString)}
        >
          {props.valueAsString}
        </button>
      )}
    </Show>
  );
}

function ValueNode(props: {
  label?: string;
  valueAsString: string;
  icon: IconComponent;
}) {
  return (
    <li class={styles.valueListItem}>
      <Show when={props.label}>
        {(label) => <NodeLabel label={label()} icon={props.icon} />}
      </Show>
      <NodeValue valueAsString={props.valueAsString} />
    </li>
  );
}

function NestedNode(props: {
  label?: string;
  icon: IconComponent;
  entries: Entry[];
  count: (value: number) => string;
  emptyText: string;
  depth: number;
  keyPath: string;
}) {
  const config = useConfig();
  const [isOpen, setIsOpen] = createSignal(
    config.shouldExpandNodeInitially({
      keyPath: props.keyPath,
      depth: props.depth,
    }),
  );
  const children = (
    <ul class={[styles.list, props.depth > 0 && styles.nested]}>
      <Show
        when={props.entries.length > 0}
        fallback={
          <li class={styles.valueListItem}>
            <NodeValue valueAsString={props.emptyText} />
          </li>
        }
      >
        <For each={props.entries}>
          {(entry) => (
            <JsonNode
              label={entry.id}
              value={entry.value}
              depth={props.depth + 1}
              keyPath={
                props.keyPath ? `${props.keyPath}.${entry.id}` : entry.id
              }
            />
          )}
        </For>
      </Show>
    </ul>
  );

  return (
    <Show
      when={props.label}
      fallback={<li class={styles.container}>{children}</li>}
    >
      {(label) => (
        <li class={styles.container}>
          <div class={styles.labelRow}>
            <button
              type="button"
              class={styles.arrowButton}
              onClick={() => setIsOpen((open) => !open)}
              aria-label={isOpen() ? "Contraer" : "Expandir"}
            >
              <span
                class={styles.chevron}
                data-open={isOpen() ? "" : undefined}
              >
                <ChevronDown size={16} />
              </span>
            </button>
            <NodeLabel label={label()} icon={props.icon} />
            <span class={styles.elementsCount}>
              {props.count(props.entries.length)}
            </span>
          </div>
          <Show when={isOpen()}>{children}</Show>
        </li>
      )}
    </Show>
  );
}

function JsonNode(props: {
  label?: string;
  value: Json;
  depth: number;
  keyPath: string;
}) {
  const config = useConfig();
  const node = createMemo(() => toNodeModel(props.value));
  const stringNode = () => {
    const current = node();
    return current.kind === "string" ? current : undefined;
  };
  const numberNode = () => {
    const current = node();
    return current.kind === "number" ? current : undefined;
  };
  const booleanNode = () => {
    const current = node();
    return current.kind === "boolean" ? current : undefined;
  };
  const arrayNode = () => {
    const current = node();
    return current.kind === "array" ? current : undefined;
  };
  const objectNode = () => {
    const current = node();
    return current.kind === "object" ? current : undefined;
  };

  return (
    <Switch>
      <Match when={node().kind === "null"}>
        <ValueNode
          label={props.label}
          icon={CircleAlert}
          valueAsString="null"
        />
      </Match>
      <Match when={stringNode()} keyed>
        {(current) => (
          <ValueNode
            label={props.label}
            icon={MessageSquare}
            valueAsString={
              current.value === "" ? config.emptyStringLabel : current.value
            }
          />
        )}
      </Match>
      <Match when={numberNode()} keyed>
        {(current) => (
          <ValueNode
            label={props.label}
            icon={Point}
            valueAsString={String(current.value)}
          />
        )}
      </Match>
      <Match when={booleanNode()} keyed>
        {(current) => (
          <ValueNode
            label={props.label}
            icon={Checkbox}
            valueAsString={String(current.value)}
          />
        )}
      </Match>
      <Match when={arrayNode()} keyed>
        {(current) => (
          <NestedNode
            label={props.label}
            icon={List}
            entries={current.entries}
            count={(count) => `[${count}]`}
            emptyText={config.emptyArrayLabel}
            depth={props.depth}
            keyPath={props.keyPath}
          />
        )}
      </Match>
      <Match when={objectNode()} keyed>
        {(current) => (
          <NestedNode
            label={props.label}
            icon={Package}
            entries={current.entries}
            count={(count) => `{${count}}`}
            emptyText={config.emptyObjectLabel}
            depth={props.depth}
            keyPath={props.keyPath}
          />
        )}
      </Match>
    </Switch>
  );
}

export function JsonTree(props: {
  value: Json;
  shouldExpandNodeInitially: ShouldExpand;
  emptyArrayLabel: string;
  emptyObjectLabel: string;
  emptyStringLabel: string;
  onNodeValueClick?: (valueAsString: string) => void;
}) {
  const config: JsonTreeConfig = {
    get shouldExpandNodeInitially() {
      return props.shouldExpandNodeInitially;
    },
    get emptyArrayLabel() {
      return props.emptyArrayLabel;
    },
    get emptyObjectLabel() {
      return props.emptyObjectLabel;
    },
    get emptyStringLabel() {
      return props.emptyStringLabel;
    },
    get onNodeValueClick() {
      return props.onNodeValueClick;
    },
  };

  return (
    <JsonTreeConfigContext value={config}>
      <ul class={styles.list}>
        <JsonNode value={props.value} depth={0} keyPath="" />
      </ul>
    </JsonTreeConfigContext>
  );
}

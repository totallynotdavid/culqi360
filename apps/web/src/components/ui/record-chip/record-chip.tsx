import { createMemo, createSignal, For, Show } from "solid-js";

import { OverflowingText } from "~/components/ui/overflow-tooltip/overflow-tooltip";

import styles from "./record-chip.module.css";

function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function initial(name: string): string {
  return (name.trim().charAt(0) || "-").toUpperCase();
}

type ChipShape = "round" | "square";

interface RecordChipProps {
  name: string;
  shape?: ChipShape;
  avatarUrl?: string | null;
  showAvatar?: boolean;
}

export function RecordChip(props: RecordChipProps) {
  const hue = createMemo(() => nameToHue(props.name));
  const shape = () => props.shape ?? "square";
  const showAvatar = () => props.showAvatar ?? true;
  const avatarShapeClass = () =>
    shape() === "round" ? styles.avatarRound : styles.avatarSquare;
  const [hasImageError, setHasImageError] = createSignal(false);

  const showImage = () =>
    showAvatar() && Boolean(props.avatarUrl) && !hasImageError();

  return (
    <span class={styles.chip}>
      <Show when={showAvatar()}>
        <Show
          when={showImage()}
          fallback={
            <span
              class={`${styles.avatar} ${avatarShapeClass()}`}
              style={{
                "background-color": `hsl(${hue()} 60% 88%)`,
                color: `hsl(${hue()} 50% 32%)`,
              }}
              aria-hidden="true"
            >
              {initial(props.name)}
            </span>
          }
        >
          <img
            src={props.avatarUrl ?? undefined}
            alt=""
            class={`${styles.avatar} ${avatarShapeClass()} ${styles.avatarImage}`}
            onError={() => setHasImageError(true)}
            aria-hidden="true"
          />
        </Show>
      </Show>
      <OverflowingText class={styles.label} text={props.name} />
    </span>
  );
}

interface RecordLinkChipProps extends RecordChipProps {
  href: string;
  target?: "_self" | "_blank";
}

export function RecordLinkChip(props: RecordLinkChipProps) {
  return (
    <span class={styles.linkChipWrap}>
      <a
        class={styles.linkChip}
        href={props.href}
        target={props.target}
        rel={props.target === "_blank" ? "noopener noreferrer" : undefined}
        data-click-outside-id="link-chip-click-outside-id"
        onClick={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <RecordChip
          name={props.name}
          shape={props.shape}
          avatarUrl={props.avatarUrl}
          showAvatar={props.showAvatar}
        />
      </a>
    </span>
  );
}

const DEFAULT_VISIBLE = 4;

interface RecordChipListProps {
  items: readonly string[];
  shape?: ChipShape;
  maxVisible?: number;
}

export function RecordChipList(props: RecordChipListProps) {
  const [visibleCount, setVisibleCount] = createSignal(
    props.maxVisible ?? DEFAULT_VISIBLE,
  );

  const visibleItems = createMemo(() => props.items.slice(0, visibleCount()));
  const hiddenCount = createMemo(() =>
    Math.max(0, props.items.length - visibleItems().length),
  );

  return (
    <div class={styles.chipList}>
      <Show
        when={props.items.length > 0}
        fallback={<span class={styles.empty}>—</span>}
      >
        <For each={visibleItems()}>
          {(item) => <RecordChip name={item} shape={props.shape} />}
        </For>
        <Show when={hiddenCount() > 0}>
          <button
            type="button"
            class={styles.moreButton}
            onClick={() =>
              setVisibleCount((n) => n + (props.maxVisible ?? DEFAULT_VISIBLE))
            }
          >
            +{hiddenCount()}
          </button>
        </Show>
      </Show>
    </div>
  );
}

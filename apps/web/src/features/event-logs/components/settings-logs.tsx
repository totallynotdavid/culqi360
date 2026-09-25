import {
  createMemo,
  createSignal,
  Loading,
  Show,
  type Accessor,
} from "solid-js";

import Pause from "~/components/icons/pause";
import Play from "~/components/icons/play";
import { Skeleton } from "~/components/ui/feedback/skeleton";
import { LightIconButton } from "~/components/ui/input/light-icon-button";
import { Card } from "~/components/ui/surfaces/card";
import type {
  EventLogQueryInput,
  EventLogTable,
} from "~/contracts/event-logs/event-log";

import { createEventLogQuery } from "../data/create-event-log-query";
import { getEventLogSource } from "../model/event-log-sources";
import { EventLogFilters } from "./event-log-filters";
import { EventLogResultsTable } from "./event-log-results-table";
import { EventLogTableSelector } from "./event-log-table-selector";

import styles from "./settings-logs.module.css";

export function SettingsLogs(props: {
  input: Accessor<EventLogQueryInput>;
  onTableChange: (table: EventLogTable) => void;
  onFiltersChange: (filters: EventLogQueryInput["filters"]) => void;
}) {
  const [isPaused, setIsPaused] = createSignal(false);
  const source = createMemo(() => getEventLogSource(props.input().table));
  const query = createEventLogQuery({
    input: props.input,
    liveEnabled: () => !isPaused(),
  });

  return (
    <div class={styles.root}>
      <Card rounded fullWidth backgroundColor="var(--surface)">
        <div class={styles.cardContent}>
          <div class={styles.selectorRow}>
            <div class={styles.selectorGrow}>
              <EventLogTableSelector
                value={props.input().table}
                onChange={props.onTableChange}
              />
            </div>
            <LightIconButton
              Icon={isPaused() ? Play : Pause}
              accent="secondary"
              size="medium"
              aria-label={isPaused() ? "Reanudar" : "Pausar"}
              onClick={() => setIsPaused((paused) => !paused)}
            />
          </div>
          <EventLogFilters
            source={source()}
            value={props.input().filters ?? {}}
            onChange={props.onFiltersChange}
          />
        </div>
      </Card>
      <div class={styles.results}>
        <div class={styles.statusRow}>
          <Show when={query.connection() === "offline"}>
            <span class={styles.offlineNotice}>
              Sin conexión. Intentando reconectar...
            </span>
          </Show>
          <Show when={query.connection() === "denied"}>
            <span class={styles.deniedNotice}>
              Se perdió la conexión. Recarga la página.
            </span>
          </Show>
          <Loading fallback={<Skeleton width={96} />}>
            <span class={styles.recordCount}>
              {query.records().length} de {query.totalCount()}
            </span>
          </Loading>
        </div>
        {/* The first page suspends here; paging past it keeps the committed
            rows on screen and reports itself through loadingMore instead. */}
        <Loading fallback={<Skeleton height={320} />}>
          <EventLogResultsTable
            columns={source().columns}
            records={query.records()}
            loadingMore={query.loadingMore()}
            hasNextPage={query.hasNextPage()}
            onLoadMore={query.loadMore}
          />
        </Loading>
      </div>
    </div>
  );
}

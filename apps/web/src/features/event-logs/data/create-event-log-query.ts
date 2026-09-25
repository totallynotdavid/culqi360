import {
  createMemo,
  createSignal,
  isPending,
  latest,
  type Accessor,
} from "solid-js";

import { createTopicFeed } from "~/browser/realtime/create-topic-feed";
import {
  parseEventLogRecordText,
  type EventLogQueryInput,
  type EventLogQueryResult,
  type EventLogRecord,
} from "~/contracts/event-logs/event-log";
import { REALTIME_CHANNELS } from "~/contracts/realtime/channel";
import { eventLogsQuery } from "~/rpc/event-logs/event-logs";

import { hasEventLogFilters } from "../model/event-log-location";

const MAX_LIVE_RECORDS = 200;

/** The first page has no cursor; every later page starts at the one before it. */
type PageCursor = string | undefined;

function queryKey(input: EventLogQueryInput): string {
  return JSON.stringify(input);
}

function recordKey(record: EventLogRecord): string {
  return `${record.table}:${record.id}`;
}

function collectRecords(
  pages: readonly EventLogQueryResult[],
  liveRecords: readonly EventLogRecord[],
): EventLogRecord[] {
  const byId = new Map<string, EventLogRecord>();

  for (const page of pages) {
    for (const record of page.records) {
      byId.set(recordKey(record), record);
    }
  }

  for (const record of liveRecords) {
    byId.set(recordKey(record), record);
  }

  return [...byId.values()].toSorted(
    (left, right) =>
      right.timestamp - left.timestamp || right.id.localeCompare(left.id),
  );
}

export function createEventLogQuery(options: {
  input: Accessor<EventLogQueryInput>;
  liveEnabled: Accessor<boolean>;
}) {
  const activeKey = createMemo(() => queryKey(options.input()));

  // Writable memo: paging appends a cursor, a new filter set recomputes back to
  // the first page. The trail is the state and the pages below are derived from
  // it, so an abandoned filter takes its in-flight tail with it.
  const [cursors, setCursors] = createSignal<readonly PageCursor[]>(() => {
    activeKey();

    return [undefined];
  });

  const pages = createMemo(async () => {
    const input = options.input();

    // Cursors already loaded resolve from the router query cache, so appending
    // one is a single request rather than a refetch of the whole trail.
    return Promise.all(
      cursors().map((after) =>
        eventLogsQuery(after ? { ...input, after } : input),
      ),
    );
  });

  // Blocks on the first page so callers render it behind a Loading boundary,
  // then holds the committed pages while the next one is in flight.
  const loadedPages = createMemo(() => latest(pages));

  const snapshotRecords = createMemo(() =>
    loadedPages().flatMap((page) => page.records),
  );

  // Live updates are only available for unfiltered views.
  const liveTable = createMemo(() => {
    const input = options.input();

    if (!options.liveEnabled() || hasEventLogFilters(input)) {
      return null;
    }

    return input.table;
  });

  const live = createTopicFeed({
    channel: REALTIME_CHANNELS.eventLogs,
    id: liveTable,
    parse: (raw) => {
      const result = parseEventLogRecordText(raw);

      return result.ok ? result.value : null;
    },
    limit: MAX_LIVE_RECORDS,
    resetKey: activeKey,
  });

  const liveRecords = live.records;

  const records = createMemo(() =>
    collectRecords(loadedPages(), liveRecords()),
  );

  const liveOnlyCount = createMemo(() => {
    const snapshotIds = new Set(snapshotRecords().map(recordKey));
    const liveOnlyIds = new Set(
      liveRecords()
        .map(recordKey)
        .filter((key) => !snapshotIds.has(key)),
    );

    return liveOnlyIds.size;
  });

  function loadMore(): void {
    const pageInfo = latest(loadedPages).at(-1)?.pageInfo;
    const cursor = pageInfo?.endCursor;

    if (!pageInfo?.hasNextPage || !cursor) {
      return;
    }

    // The committed trail still ends at the previous cursor while a page is in
    // flight, so refusing a duplicate is what stops a double click.
    setCursors((current) =>
      current.includes(cursor) ? current : [...current, cursor],
    );
  }

  return {
    records,
    totalCount: () => (loadedPages()[0]?.totalCount ?? 0) + liveOnlyCount(),
    hasNextPage: () => loadedPages().at(-1)?.pageInfo.hasNextPage ?? false,
    loadingMore: () => isPending(loadedPages),
    connection: live.connection,
    loadMore,
  };
}

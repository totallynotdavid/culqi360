import {
  createEffect,
  createMemo,
  createSignal,
  on,
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

  const firstPage = createMemo(async () => {
    const input = options.input();
    const key = queryKey(input);
    const page = await eventLogsQuery(input);

    return { key, page };
  });

  const [extraPages, setExtraPages] = createSignal<EventLogQueryResult[]>([]);
  const [loadingMore, setLoadingMore] = createSignal(false);

  let requestGeneration = 0;

  createEffect(
    on(activeKey, () => {
      requestGeneration += 1;
      setExtraPages([]);
      setLoadingMore(false);
    }),
  );

  const currentFirstPage = createMemo(() => {
    const result = firstPage();

    return result?.key === activeKey() ? result.page : undefined;
  });

  const pages = createMemo(() => {
    const initialPage = currentFirstPage();

    return initialPage ? [initialPage, ...extraPages()] : extraPages();
  });

  const snapshotRecords = createMemo(() =>
    pages().flatMap((page) => page.records),
  );

  const lastPage = createMemo(() => pages().at(-1));

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

  const records = createMemo(() => collectRecords(pages(), liveRecords()));

  const liveOnlyCount = createMemo(() => {
    const snapshotIds = new Set(snapshotRecords().map(recordKey));
    const liveOnlyIds = new Set(
      liveRecords()
        .map(recordKey)
        .filter((key) => !snapshotIds.has(key)),
    );

    return liveOnlyIds.size;
  });

  async function loadMore(): Promise<void> {
    const page = lastPage();
    const cursor = page?.pageInfo.endCursor;

    if (!page?.pageInfo.hasNextPage || !cursor || loadingMore()) {
      return;
    }

    const input = options.input();
    const key = queryKey(input);
    const generation = ++requestGeneration;

    setLoadingMore(true);

    try {
      const nextPage = await eventLogsQuery({ ...input, after: cursor });

      if (generation !== requestGeneration || key !== activeKey()) {
        return;
      }

      setExtraPages((previous) => [...previous, nextPage]);
    } finally {
      if (generation === requestGeneration) {
        setLoadingMore(false);
      }
    }
  }

  return {
    records,
    totalCount: () => (currentFirstPage()?.totalCount ?? 0) + liveOnlyCount(),
    hasNextPage: () => lastPage()?.pageInfo.hasNextPage ?? false,
    loading: () => currentFirstPage() === undefined || loadingMore(),
    connection: live.connection,
    loadMore,
  };
}

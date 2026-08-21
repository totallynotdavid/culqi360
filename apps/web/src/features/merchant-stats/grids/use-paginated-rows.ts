import {
  createMemo,
  createSignal,
  isPending,
  latest,
  type Accessor,
} from "solid-js";

import type { Page, PublishedPage } from "~/contracts/merchant-stats/views";

export const GPV_GRID_PAGE_SIZE = 60;

interface PaginatedRowsConfig<Row> {
  pageSize: number;
  resetKey: Accessor<string>;
  load: (page: Page) => Promise<PublishedPage<Row>>;
}

interface PaginatedRows<Row> {
  rows: Accessor<ReadonlyArray<Row>>;
  loading: Accessor<boolean>;
  hasMore: Accessor<boolean>;
  onLoadMore: () => void;
}

/**
 * Every page comes from a separate request, so a snapshot published mid scroll
 * gives the later ones a different publication. Offsets are only comparable
 * within one publication, so the trail stops at the first page that disagrees
 * with the one it started from.
 */
function consistentPrefix<Row>(
  pages: ReadonlyArray<PublishedPage<Row>>,
): ReadonlyArray<PublishedPage<Row>> {
  const drift = pages.findIndex(
    (page) => page.publicationId !== pages[0]?.publicationId,
  );

  return drift === -1 ? pages : pages.slice(0, drift);
}

export function usePaginatedRows<Row>(
  config: PaginatedRowsConfig<Row>,
): PaginatedRows<Row> {
  // Writable memo: load-more raises the count, a new filter set recomputes back
  // to one page.
  const [pageCount, setPageCount] = createSignal<number>(() => {
    config.resetKey();

    return 1;
  });

  const pages = createMemo(async () =>
    Promise.all(
      Array.from({ length: pageCount() }, (_, index) =>
        config.load({
          limit: config.pageSize,
          offset: index * config.pageSize,
        }),
      ),
    ),
  );

  // Blocks on the first page so callers render it behind a Loading boundary,
  // then holds the committed pages while the next one is in flight.
  const loadedPages = createMemo(() => consistentPrefix(latest(pages)));

  const rows = createMemo(() => loadedPages().flatMap((page) => page.rows));

  const hasMore = () => loadedPages().at(-1)?.rows.length === config.pageSize;

  return {
    rows,
    loading: () => isPending(loadedPages),
    hasMore,
    onLoadMore: () => {
      if (hasMore()) {
        setPageCount((count) => count + 1);
      }
    },
  };
}

import { useIsRouting } from "@solidjs/router";
import { createMemo, createSignal, type Accessor } from "solid-js";

import type { Page, PublishedPage } from "~/contracts/merchant-stats/views";

export const GPV_GRID_PAGE_SIZE = 60;

interface PaginatedRowsConfig<Row> {
  pageSize: number;
  resetKey: Accessor<string>;
  load: (page: Page) => Promise<PublishedPage<Row>>;
}

interface LoadedPage<Row> {
  key: string;
  publicationId: string | null;
  rows: ReadonlyArray<Row>;
}

interface PaginatedRows<Row> {
  rows: Accessor<ReadonlyArray<Row>>;
  loading: Accessor<boolean>;
  hasMore: Accessor<boolean>;
  onLoadMore: () => void;
}

export function usePaginatedRows<Row>(
  config: PaginatedRowsConfig<Row>,
): PaginatedRows<Row> {
  const isRouting = useIsRouting();
  const [extraPages, setExtraPages] = createSignal<LoadedPage<Row>[]>([]);
  const [loadingKey, setLoadingKey] = createSignal<string | null>(null);
  const [loadError, setLoadError] = createSignal<{
    key: string;
    error: unknown;
  }>();

  const firstPage = createMemo(async () => {
    const key = config.resetKey();
    const page = await config.load({ limit: config.pageSize, offset: 0 });
    return { key, ...page } satisfies LoadedPage<Row>;
  });

  const currentPages = createMemo<ReadonlyArray<LoadedPage<Row>>>(() => {
    const key = config.resetKey();
    const first = firstPage();
    if (first?.key !== key) {
      return [];
    }

    return [
      first,
      ...extraPages().filter(
        (page) =>
          page.key === key && page.publicationId === first.publicationId,
      ),
    ];
  });

  const rows = (): ReadonlyArray<Row> => {
    const failure = loadError();
    if (failure?.key === config.resetKey()) {
      throw failure.error;
    }
    return currentPages().flatMap((page) => page.rows);
  };

  const hasMore = () => {
    const last = currentPages().at(-1);
    return last?.rows.length === config.pageSize;
  };

  async function loadMore(): Promise<void> {
    const key = config.resetKey();
    const publicationId = firstPage()?.publicationId;
    if (loadingKey() === key || !hasMore()) {
      return;
    }

    const offset = rows().length;
    setLoadingKey(key);
    setLoadError(undefined);

    try {
      const nextPage = await config.load({
        limit: config.pageSize,
        offset,
      });
      if (
        key !== config.resetKey() ||
        nextPage.publicationId !== publicationId
      ) {
        return;
      }
      setExtraPages((pages) => [
        ...pages.filter(
          (page) => page.key === key && page.publicationId === publicationId,
        ),
        { key, ...nextPage },
      ]);
    } catch (caught: unknown) {
      if (key === config.resetKey()) {
        setLoadError({ key, error: caught });
      }
    } finally {
      if (loadingKey() === key) {
        setLoadingKey(null);
      }
    }
  }

  return {
    rows,
    loading: () => loadingKey() === config.resetKey() || isRouting(),
    hasMore,
    onLoadMore: () => void loadMore(),
  };
}

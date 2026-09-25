import { useSearchParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  type Accessor,
} from "solid-js";

import { LEAD_WORKSPACE_FILTER_DEFAULT } from "./filter-query";
import { parseLeadPageIndex } from "./lead-list-query";
import { LEAD_WORKSPACE_SORT_DEFAULT } from "./sort-query";
import { resolveWorkspaceView, type WorkspaceView } from "./views";

const SEARCH_DEBOUNCE_MS = 250;

type RouteControl<T> = {
  value: Accessor<T>;
  set: (value: T) => void;
};

type LeadIndexRoute = {
  activeView: Accessor<WorkspaceView>;
  view: RouteControl<string>;
  filter: RouteControl<string | undefined>;
  sort: RouteControl<string | undefined>;
  search: RouteControl<string> & { query: Accessor<string | undefined> };
  page: {
    index: Accessor<number>;
    next: () => void;
    previous: () => void;
  };
};

export function useLeadIndexRoute(options: {
  availableViews: ReadonlyArray<WorkspaceView>;
  defaultViewId: string;
}): LeadIndexRoute {
  const [searchParams, setSearchParams] = useSearchParams<{
    filter?: string;
    page?: string;
    query?: string;
    sort?: string;
    view?: string;
  }>();
  const activeView = createMemo(() =>
    resolveWorkspaceView(
      options.availableViews,
      options.defaultViewId,
      searchParams.view,
    ),
  );
  const activeViewId = () => activeView().id;
  const pageIndex = () => parseLeadPageIndex(searchParams.page);
  const filter = () => searchParams.filter ?? LEAD_WORKSPACE_FILTER_DEFAULT;
  const sort = () => searchParams.sort ?? LEAD_WORKSPACE_SORT_DEFAULT;
  const search = () => searchParams.query ?? "";
  const [debouncedSearch, setDebouncedSearch] = createSignal(search().trim());

  createEffect(search, (value) => {
    const normalized = value.trim();
    if (!normalized) {
      setDebouncedSearch("");
      return;
    }

    const timeout = setTimeout(
      () => setDebouncedSearch(normalized),
      SEARCH_DEBOUNCE_MS,
    );
    // Returning the teardown cancels the pending timer before the next
    // keystroke schedules its own, which is what makes this a debounce.
    return () => clearTimeout(timeout);
  });

  return {
    activeView,
    view: {
      value: activeViewId,
      set(viewId) {
        setSearchParams({
          view: viewId === options.defaultViewId ? null : viewId,
          page: null,
          query: null,
        });
      },
    },
    filter: {
      value: filter,
      set(value) {
        setSearchParams({
          filter:
            value && value !== LEAD_WORKSPACE_FILTER_DEFAULT ? value : null,
          page: null,
        });
      },
    },
    sort: {
      value: sort,
      set(value) {
        setSearchParams({
          sort: value && value !== LEAD_WORKSPACE_SORT_DEFAULT ? value : null,
          page: null,
        });
      },
    },
    search: {
      value: search,
      query: () => debouncedSearch() || undefined,
      set(value) {
        setSearchParams({ query: value || null, page: null });
      },
    },
    page: {
      index: pageIndex,
      next: () => setSearchParams({ page: String(pageIndex() + 1) }),
      previous() {
        const previous = Math.max(0, pageIndex() - 1);
        setSearchParams({ page: previous === 0 ? null : String(previous) });
      },
    },
  };
}

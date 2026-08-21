import { lazy } from "solid-js";

// Page bodies stay lazy; skeletons and header chrome are eager and live with the
// registry.

export const CreateLeadPage = lazy(() =>
  import("../pages/create-lead/page").then((m) => ({
    default: m.CreateLeadPage,
  })),
);

export const RootPage = lazy(() =>
  import("../pages/root/page").then((m) => ({
    default: m.RootPage,
  })),
);

export const SearchRecordsPage = lazy(() =>
  import("../pages/search-records/page").then((m) => ({
    default: m.SearchRecordsPage,
  })),
);

export const RecordPage = lazy(() =>
  import("../pages/record-page/page").then((m) => ({
    default: m.RecordPage,
  })),
);

export const LeadActionPage = lazy(() =>
  import("../pages/lead-action/page").then((m) => ({
    default: m.LeadActionPage,
  })),
);

export const DataGridDetailPage = lazy(() =>
  import("../pages/data-grid-detail/page").then((m) => ({
    default: m.DataGridDetailPage,
  })),
);

// These are the only pages commonly opened before the panel is already active.
export function preloadSidePanelEntryPages(): void {
  void RootPage.preload();
  void SearchRecordsPage.preload();
}

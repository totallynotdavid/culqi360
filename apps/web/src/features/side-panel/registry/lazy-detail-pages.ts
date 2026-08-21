import { lazy } from "solid-js";

// The two pages a search result opens. They live apart from the rest of the
// lazy handles so the results page can warm the chunk it is about to navigate
// to without importing a registry that lazily imports the results page back.

export const SearchPersonPage = lazy(() =>
  import("../pages/search-person/page").then((m) => ({
    default: m.SearchPersonPage,
  })),
);

export const SearchCompanyPage = lazy(() =>
  import("../pages/search-company/page").then((m) => ({
    default: m.SearchCompanyPage,
  })),
);

// Hover or focus is a strong enough signal to preload the matching detail page.
export function preloadSidePanelSearchResultDetailPage(
  kind: "person" | "company",
): void {
  if (kind === "person") {
    void SearchPersonPage.preload();
    return;
  }

  void SearchCompanyPage.preload();
}

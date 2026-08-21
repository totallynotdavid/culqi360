import type { Component } from "solid-js";

import { CompactDetailPageSkeleton } from "../pages/common/skeletons/compact-detail-page-skeleton";
import { ListPageSkeleton } from "../pages/common/skeletons/list-page-skeleton";
import { RecordPageSkeleton } from "../pages/common/skeletons/record-page-skeleton";
import { CreateLeadPageInfo } from "../pages/create-lead/page-info";
import { DataGridDetailPageInfo } from "../pages/data-grid-detail/page-info";
import { LeadActionPageInfo } from "../pages/lead-action/page-info";
import { RecordPageInfo } from "../pages/record-page/page-info";
import { SearchCompanyPageInfo } from "../pages/search-company/page-info";
import { SearchPersonPageInfo } from "../pages/search-person/page-info";
import type { SidePanelPageKey } from "../types/side-panel-page";
import { SearchCompanyPage, SearchPersonPage } from "./lazy-detail-pages";
import {
  CreateLeadPage,
  DataGridDetailPage,
  LeadActionPage,
  RecordPage,
  RootPage,
  SearchRecordsPage,
} from "./lazy-pages";

type SidePanelPageConfig = {
  showsSearch: boolean;
  component: Component;
  skeleton: Component;
  pageInfoComponent?: Component;
  topBarActionsComponent?: Component;
};

export const SIDE_PANEL_PAGES_CONFIG = {
  "create-lead": {
    showsSearch: false,
    component: CreateLeadPage,
    skeleton: RecordPageSkeleton,
    pageInfoComponent: CreateLeadPageInfo,
    topBarActionsComponent: undefined,
  },
  root: {
    showsSearch: true,
    component: RootPage,
    skeleton: ListPageSkeleton,
    pageInfoComponent: undefined,
    topBarActionsComponent: undefined,
  },
  "search-records": {
    showsSearch: true,
    component: SearchRecordsPage,
    skeleton: ListPageSkeleton,
    pageInfoComponent: undefined,
    topBarActionsComponent: undefined,
  },
  "search-person-detail": {
    showsSearch: false,
    component: SearchPersonPage,
    skeleton: CompactDetailPageSkeleton,
    pageInfoComponent: SearchPersonPageInfo,
    topBarActionsComponent: undefined,
  },
  "search-company-detail": {
    showsSearch: false,
    component: SearchCompanyPage,
    skeleton: CompactDetailPageSkeleton,
    pageInfoComponent: SearchCompanyPageInfo,
    topBarActionsComponent: undefined,
  },
  "view-record": {
    showsSearch: false,
    component: RecordPage,
    skeleton: RecordPageSkeleton,
    pageInfoComponent: RecordPageInfo,
    topBarActionsComponent: undefined,
  },
  "lead-action": {
    showsSearch: false,
    component: LeadActionPage,
    skeleton: RecordPageSkeleton,
    pageInfoComponent: LeadActionPageInfo,
    topBarActionsComponent: undefined,
  },
  "data-grid-detail": {
    showsSearch: false,
    component: DataGridDetailPage,
    skeleton: CompactDetailPageSkeleton,
    pageInfoComponent: DataGridDetailPageInfo,
    topBarActionsComponent: undefined,
  },
} satisfies Record<SidePanelPageKey, SidePanelPageConfig>;

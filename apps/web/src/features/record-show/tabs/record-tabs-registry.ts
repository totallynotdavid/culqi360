import type { JSX } from "@solidjs/web";

import Building2 from "~/components/icons/building-2";
import ChartColumn from "~/components/icons/chart-column";
import Checkbox from "~/components/icons/checkbox";
import HomeTabler from "~/components/icons/home-tabler";
import MessageSquare from "~/components/icons/message-square";
import Paperclip from "~/components/icons/paperclip";
import Plus from "~/components/icons/plus";
import TimelineEvent from "~/components/icons/timeline-event";
import type { LeadStage } from "~/contracts/workflow/vocabulary";
import { ActividadTab } from "~/features/record-show/actividad/actividad-tab";
import { AfiliacionTab } from "~/features/record-show/afiliacion/afiliacion-tab";
import { DatosTab } from "~/features/record-show/datos/datos-tab";
import { GpvTab } from "~/features/record-show/gpv/gpv-tab";
import type { RecordContext } from "~/features/record-show/model/record-context";
import type { RecordTabId } from "~/features/record-show/model/record-tab-id";
import { NotasTab } from "~/features/record-show/notas/notas-tab";
import { RegistroTab } from "~/features/record-show/registro/registro-tab";
import { FilesTab } from "~/features/record-show/tabs/files-tab";
import { TareasTab } from "~/features/record-show/tareas/tareas-tab";
import type { TabIconComponent } from "~/features/side-panel/components/tab-strip";

type RecordTabKind = RecordContext["kind"];

export type RecordTabDefinition = {
  id: RecordTabId;
  label: string;
  icon?: TabIconComponent;
  visibleForKinds: readonly RecordTabKind[];
  isVisibleAtStage?: (stage: LeadStage) => boolean;
  component: (props: {
    context: RecordContext;
    onNavigate: (id: RecordTabId) => void;
  }) => JSX.Element;
};

const LEAD: readonly RecordTabKind[] = ["lead"];
const DRAFT: readonly RecordTabKind[] = ["draft"];
const BOTH: readonly RecordTabKind[] = ["lead", "draft"];

const isAfiliacionStage = (stage: LeadStage) =>
  stage === "SETUP" || stage === "LIVE";

const RECORD_TABS: readonly RecordTabDefinition[] = [
  {
    id: "registro",
    icon: Plus,
    label: "Registro",
    visibleForKinds: DRAFT,
    component: RegistroTab,
  },
  {
    id: "datos",
    icon: HomeTabler,
    label: "Datos",
    visibleForKinds: LEAD,
    component: DatosTab,
  },
  {
    id: "actividad",
    icon: TimelineEvent,
    label: "Actividad",
    visibleForKinds: BOTH,
    component: ActividadTab,
  },
  {
    id: "tareas",
    icon: Checkbox,
    label: "Tareas",
    visibleForKinds: LEAD,
    component: TareasTab,
  },
  {
    id: "afiliacion",
    icon: Building2,
    label: "Afiliación",
    visibleForKinds: LEAD,
    isVisibleAtStage: isAfiliacionStage,
    component: AfiliacionTab,
  },
  {
    id: "gpv",
    icon: ChartColumn,
    label: "GPV",
    visibleForKinds: LEAD,
    component: GpvTab,
  },
  {
    id: "notas",
    icon: MessageSquare,
    label: "Notas",
    visibleForKinds: LEAD,
    component: NotasTab,
  },
  {
    id: "archivos",
    icon: Paperclip,
    label: "Archivos",
    visibleForKinds: LEAD,
    component: FilesTab,
  },
];

function isTabVisible(
  tab: RecordTabDefinition,
  context: RecordContext,
): boolean {
  if (!tab.visibleForKinds.includes(context.kind)) {
    return false;
  }

  if (tab.isVisibleAtStage && context.kind === "lead") {
    return tab.isVisibleAtStage(context.data.lead.stage);
  }

  return true;
}

export function recordTabsFor(context: RecordContext): RecordTabDefinition[] {
  return RECORD_TABS.filter((tab) => isTabVisible(tab, context));
}

export function resolveActiveRecordTabId(
  tabId: string,
  kind: RecordTabKind,
): RecordTabId {
  const available = RECORD_TABS.filter((tab) =>
    tab.visibleForKinds.includes(kind),
  );

  const match = available.find((tab) => tab.id === tabId);

  return match ? match.id : available[0].id;
}

export function recordTabDisplayLabel(tabId: RecordTabId): string {
  const tab = RECORD_TABS.find((entry) => entry.id === tabId);

  return tab?.label ?? "";
}

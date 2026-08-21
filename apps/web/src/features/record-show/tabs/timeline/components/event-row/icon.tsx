import type { JSX } from "@solidjs/web";

import Package from "~/components/icons/package";
import Plus from "~/components/icons/plus";
import TimelineEvent from "~/components/icons/timeline-event";
import type { LeadTimelineItem } from "~/contracts/workflow/views";

export function eventIcon(kind: LeadTimelineItem["kind"]): JSX.Element {
  if (kind === "stage-change") {
    return <Package size={14} />;
  }

  if (kind === "note") {
    return <Plus size={14} />;
  }

  return <TimelineEvent size={14} />;
}

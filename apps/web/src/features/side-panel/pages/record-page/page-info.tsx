import { clsx } from "clsx";
import { Show, createMemo } from "solid-js";

import { Avatar } from "~/components/ui/display/avatar";
import { Tag } from "~/components/ui/tag/tag";
import {
  leadStageColor,
  leadStageLabel,
} from "~/features/workflow/presentation/lead-display";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";

import { PageInfoLayout } from "../../top-bar/page-info-layout";
import { useLeadRecordPageState } from "./state";

import styles from "./page-info.module.css";

function firstInitial(name: string): string {
  return (name.trim()[0] ?? "-").toUpperCase();
}

export function RecordPageInfo() {
  const { pageState, leadId } = useLeadRecordPageState();
  const leadDetail = createMemo(() => leadDetailQuery(leadId()));

  const isNameEmpty = () => !pageState().title.trim();

  return (
    <PageInfoLayout
      icon={
        <Avatar
          imageUrl={null}
          fallback={firstInitial(pageState().title)}
          class={clsx(styles.avatar, isNameEmpty() && styles.avatarEmpty)}
          fallbackClass={clsx(
            styles.avatarFallback,
            isNameEmpty() && styles.avatarFallbackEmpty,
          )}
        />
      }
      title={pageState().title}
      badge={
        <Show when={leadDetail()} keyed>
          {(data) => (
            <Tag
              color={leadStageColor(data.lead.stage)}
              text={leadStageLabel(data.lead.stage)}
              preventShrink
            />
          )}
        </Show>
      }
    />
  );
}

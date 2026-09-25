import { Title } from "@solidjs/meta";
import { Show, createMemo, type ParentProps } from "solid-js";

import Building2 from "~/components/icons/building-2";
import { PageCardHeader } from "~/components/ui/layout/page-card/page-card-header";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";
import { leadListQuery } from "~/rpc/workflow/lead-list";

import styles from "./record-show-header.module.css";

const LEAD_NAVIGATION_LIMIT = 200;

export function RecordShowHeader(
  props: ParentProps<{
    leadId: string;
  }>,
) {
  const data = createMemo(() => leadDetailQuery(props.leadId));
  const leadList = createMemo(() =>
    leadListQuery({
      limit: LEAD_NAVIGATION_LIMIT,
      offset: 0,
    }),
  );

  const lead = createMemo(() => data()?.lead);

  const displayName = createMemo(
    () => lead()?.legalName ?? lead()?.ruc ?? "Sin nombre",
  );

  const documentTitle = createMemo(() => {
    const name = lead()?.legalName ?? lead()?.ruc;

    return name ? `${name} - Registro` : "Registro";
  });

  const currentIndex = createMemo(() => {
    const rows = leadList()?.rows;

    if (!rows) {
      return -1;
    }

    return rows.findIndex((row) => row.id === props.leadId);
  });

  const paginationLabel = createMemo(() => {
    const totalCount = leadList()?.totalCount;
    const index = currentIndex();

    if (!totalCount || index < 0) {
      return null;
    }

    return `(${index + 1}/${totalCount})`;
  });

  return (
    <>
      <Title>{documentTitle()}</Title>

      <PageCardHeader
        breadcrumb={
          <span class={styles.breadcrumb}>
            <a
              href="/records"
              class={styles.breadcrumbLink}
              aria-label="Volver a Registros"
            >
              <span class={styles.breadcrumbPrefix}>
                <span class={styles.objectIconBadge}>
                  <Building2 size={14} />
                </span>
                <span>Registros</span>
              </span>
            </a>

            <span class={styles.breadcrumbSep}>/</span>

            <span class={styles.breadcrumbCurrent} title={displayName()}>
              {displayName()}
            </span>

            <Show when={paginationLabel()}>
              {(label) => <span class={styles.paginationInfo}>{label()}</span>}
            </Show>
          </span>
        }
        actionButton={props.children}
      />
    </>
  );
}

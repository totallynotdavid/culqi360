import { For, Show, createMemo } from "solid-js";

import { EmptyState } from "~/components/feedback/empty-state/empty";
import Phone from "~/components/icons/phone";
import { AppPage } from "~/components/layout/page";
import { CallWithExtension } from "~/features/extension/call-with-extension";
import { myContactAssignmentsQuery } from "~/rpc/contact-assignments/my-assignments";

import styles from "./assignments-page.module.css";

export default function MyAssignmentsPage() {
  const assignments = createMemo(() => myContactAssignmentsQuery(), {
    loadingValue: [],
  });

  return (
    <AppPage width="medium">
      <Show
        when={assignments().length > 0}
        fallback={
          <EmptyState
            icon={Phone}
            title="Sin contactos asignados"
            description="Solicita nuevas asignaciones desde Mi capacidad."
          />
        }
      >
        <ul class={styles.list}>
          <For each={assignments()}>
            {(assignment) => (
              <li class={styles.row}>
                <div class={styles.contact}>
                  <span class={styles.name}>{assignment.name}</span>
                  <span class={styles.phone}>
                    {assignment.phone ?? "Sin teléfono"}
                  </span>
                </div>
                <Show when={assignment.phone}>
                  <CallWithExtension assignmentId={assignment.assignmentId} />
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </AppPage>
  );
}

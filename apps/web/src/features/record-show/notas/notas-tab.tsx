import { useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";

import { Button } from "~/components/ui/input/button";
import { actionErrorMessage } from "~/contracts/errors";
import type { LeadDetailView } from "~/contracts/workflow/views";
import { formatAppDateTime } from "~/domain/time/app-time";
import type { RecordContext } from "~/features/record-show/model/record-context";
import { ActivityTabEmptyState } from "~/features/side-panel/components/activity-tabs/empty-state";
import { addNoteMutation } from "~/features/workflow/data/command-mutations";
import { revalidateWorkflowLead } from "~/features/workflow/data/revalidate-workflow";

import styles from "./notas.module.css";

export function NotasTab(props: { context: RecordContext }) {
  return (
    <Show
      when={props.context.kind === "lead" ? props.context.data : null}
      keyed
    >
      {(data) => <NotasView data={data} />}
    </Show>
  );
}

function NotasView(props: { data: LeadDetailView }) {
  const add = useAction(addNoteMutation);
  const notes = () =>
    props.data.timeline
      .filter((event) => event.kind === "note")
      .toSorted((a, b) => b.occurredAt - a.occurredAt);
  const canAdd = () => props.data.availableActions.includes("add-note");

  const [body, setBody] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const trimmed = body().trim();
    if (!trimmed) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      await add({ leadId: props.data.lead.id, body: trimmed });
      revalidateWorkflowLead(props.data.lead.id);
      setBody("");
    } catch (caught) {
      setErrorMessage(actionErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class={styles.container}>
      <Show when={canAdd()}>
        <form
          class={styles.composer}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <textarea
            class={styles.textarea}
            rows={3}
            value={body()}
            onInput={(event) => setBody(event.currentTarget.value)}
            placeholder="Escribe una nota..."
          />
          <Show when={errorMessage()}>
            {(msg) => <p class={styles.error}>{msg()}</p>}
          </Show>
          <div class={styles.composerActions}>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saving()}
              disabled={!body().trim()}
            >
              Agregar nota
            </Button>
          </div>
        </form>
      </Show>

      <Show
        when={notes().length > 0}
        fallback={
          <ActivityTabEmptyState
            type="emptyTimeline"
            title="Sin notas"
            subtitle="Aún no hay notas en este registro."
          />
        }
      >
        <ul class={styles.list}>
          <For each={notes()}>
            {(note) => (
              <li class={styles.note}>
                <div class={styles.noteHeader}>
                  <span class={styles.noteAuthor}>{note.actorDisplayName}</span>
                  <span class={styles.noteDate}>
                    {formatAppDateTime(note.occurredAt)}
                  </span>
                </div>
                <p class={styles.noteBody}>{note.description}</p>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

import { useAction } from "@solidjs/router";
import { clsx } from "clsx";
import {
  action,
  createOptimisticStore,
  createSignal,
  For,
  Show,
} from "solid-js";

import Bell from "~/components/icons/bell";
import { TopBarActionButton } from "~/components/layout/top-bar-action-button";
import { TopBarTooltip } from "~/components/layout/top-bar-tooltip";
import { useDismissibleLayer } from "~/components/ui/utilities/use-dismissible-layer";
import { formatAppDateTime } from "~/domain/time/app-time";
import {
  markAllNotificationsReadMutation,
  markNotificationReadMutation,
} from "~/features/notifications/data/mutations";
import { headerNotificationsQuery } from "~/rpc/notifications/header-notifications";

import styles from "./header-notifications-panel.module.css";

export function HeaderNotificationsPanel() {
  const [open, setOpen] = createSignal(false);

  // The seed keeps the bell rendered before the first response instead of
  // suspending the surrounding header.
  const [feed, setFeed] = createOptimisticStore(
    () => headerNotificationsQuery(),
    { unreadCount: 0, notifications: [] },
  );

  const markRead = useAction(markNotificationReadMutation);
  const markAllRead = useAction(markAllNotificationsReadMutation);

  // Writes inside an action are tentative for its lifetime: the mutation's
  // revalidation supersedes them, and a failure reverts them on its own.
  const markOneRead = action(function* (notificationId: string) {
    setFeed((draft) => {
      const item = draft.notifications.find(
        (candidate) => candidate.id === notificationId,
      );

      if (!item || item.readAt !== null) {
        return;
      }

      item.readAt = Date.now();
      draft.unreadCount = Math.max(0, draft.unreadCount - 1);
    });

    yield markRead(notificationId);
  });

  const markEveryRead = action(function* () {
    const readAt = Date.now();

    setFeed((draft) => {
      for (const item of draft.notifications) {
        item.readAt ??= readAt;
      }

      draft.unreadCount = 0;
    });

    yield markAllRead();
  });

  let containerRef: HTMLDivElement | undefined;

  useDismissibleLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    getContainer: () => containerRef,
  });

  return (
    <div
      ref={(element) => {
        containerRef = element;
      }}
      class={styles.root}
    >
      <TopBarTooltip content="Notificaciones">
        <TopBarActionButton
          ariaLabel="Notificaciones"
          iconOnly
          onClick={() => setOpen((value) => !value)}
          class={styles.triggerRoot}
          buttonClass={styles.trigger}
        >
          <>
            <span class={styles.icon}>
              <Bell size={14} />
            </span>

            <Show when={feed.unreadCount > 0}>
              <span class={styles.badge}>{Math.min(feed.unreadCount, 99)}</span>
            </Show>
          </>
        </TopBarActionButton>
      </TopBarTooltip>

      <Show when={open()}>
        <div class={styles.panel}>
          <div class={styles.panelHeader}>
            <p class={styles.panelTitle}>Notificaciones</p>

            <button
              type="button"
              class={styles.markAll}
              onClick={() => void markEveryRead()}
              disabled={feed.unreadCount === 0}
            >
              Marcar todas como leídas
            </button>
          </div>

          <div class={styles.list}>
            <For
              each={feed.notifications}
              fallback={<p class={styles.empty}>Sin notificaciones aún.</p>}
            >
              {(item) => (
                <article
                  class={clsx(
                    styles.item,
                    item.readAt === null && styles.itemUnread,
                  )}
                >
                  <p class={styles.title}>{item.title}</p>
                  <p class={styles.body}>{item.bodyText}</p>

                  <div class={styles.meta}>
                    <span class={styles.time}>
                      {formatAppDateTime(item.createdAt)}
                    </span>

                    <Show when={item.readAt === null}>
                      <button
                        type="button"
                        class={styles.readBtn}
                        onClick={() => void markOneRead(item.id)}
                      >
                        Marcar como leída
                      </button>
                    </Show>
                  </div>
                </article>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

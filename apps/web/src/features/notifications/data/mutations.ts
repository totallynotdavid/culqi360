import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "~/rpc/app-notifications";
import { headerNotificationsQuery } from "~/rpc/notifications/header-notifications";
import { notificationPreferencesQuery } from "~/rpc/notifications/notification-preferences";
import { setNotificationPreference } from "~/rpc/settings/notifications";

export const markNotificationReadMutation = action(
  async (notificationId: string) => {
    await markNotificationRead(notificationId);
    return respond({}, { revalidate: headerNotificationsQuery.key });
  },
  "markNotificationRead",
);

export const markAllNotificationsReadMutation = action(async () => {
  await markAllNotificationsRead();
  return respond({}, { revalidate: headerNotificationsQuery.key });
}, "markAllNotificationsRead");

export const setNotificationPreferenceMutation = action(
  async (category: string, channel: string, enabled: boolean) => {
    const result = await setNotificationPreference(category, channel, enabled);
    return respond(result, { revalidate: notificationPreferencesQuery.key });
  },
  "setNotificationPreference",
);

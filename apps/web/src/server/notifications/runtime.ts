import { createEmailComposer } from "@crm/email-composer";
import {
  createKapsoProvider,
  createLogProvider,
  createMessageChannels,
  createResendProvider,
  createWhatsAppCloudProvider,
  type DeliveryProvider,
} from "@crm/message-channels";
import type { Kysely } from "kysely";

import type { AppNotificationId, UserId } from "~/domain/ids";
import { receiveKapsoWebhook } from "~/server/integrations/kapso/webhooks/receive-webhook";
import type {
  ExternalChannel,
  NotificationCategory,
} from "~/server/notifications/categories";
import {
  createMessagingGateway,
  type MessagingGateway,
} from "~/server/notifications/channels/messaging-gateway";
import { createDeliveryDispatchQueue } from "~/server/notifications/dispatch/queue";
import { createDeliverySender } from "~/server/notifications/dispatch/send-delivery";
import { createIntentExpander } from "~/server/notifications/expansion/expand-intent";
import { createRecipientPlanner } from "~/server/notifications/expansion/plan-recipients";
import { createIntentExpansionQueue } from "~/server/notifications/expansion/queue";
import { enqueueNotifications } from "~/server/notifications/intent/enqueue";
import { createOutboundWhatsAppQueue } from "~/server/notifications/outbound/queue";
import { createAppNotificationRepo } from "~/server/notifications/repos/app-notification";
import { createDeliveryRepository } from "~/server/notifications/repos/delivery-repo";
import { createIntentRepository } from "~/server/notifications/repos/intent-repo";
import { createNotificationOptOutRepo } from "~/server/notifications/repos/opt-out-repo";
import { createUserChannelAddressRepo } from "~/server/notifications/repos/user-channel-address";
import type { NotificationIntent } from "~/server/notifications/types";
import { createWhatsAppInboundQueue } from "~/server/notifications/whatsapp-inbound/queue";
import type {
  AppConfig,
  NotificationsConfig,
} from "~/server/platform/config/env";
import type { Database } from "~/server/platform/database/types";
import type { ServerInfrastructure } from "~/server/platform/infrastructure";
import type { QueueRunner } from "~/server/platform/jobs/types";
import type { OperationContext } from "~/server/platform/operation/context";
import type { Logger } from "~/shared/observability/logger";
import { createLogger } from "~/shared/observability/runtime-logger";

export interface NotificationPipelineDeps {
  db: Kysely<Database>;
  messaging: MessagingGateway;
  publicOrigin: string;
  logger: Logger;
  whatsappWebhookVerifyToken: string;
}

export interface NotificationPipeline {
  messaging: MessagingGateway;
  getHeader(
    userId: UserId,
    limit: number,
  ): Promise<{
    unreadCount: number;
    notifications: Awaited<
      ReturnType<ReturnType<typeof createAppNotificationRepo>["listByUser"]>
    >;
  }>;
  markRead(
    userId: UserId,
    notificationId: AppNotificationId,
    operation: OperationContext,
  ): Promise<void>;
  markAllRead(userId: UserId, operation: OperationContext): Promise<void>;
  listPreferences(userId: UserId): Promise<{
    optOuts: Awaited<
      ReturnType<ReturnType<typeof createNotificationOptOutRepo>["listForUser"]>
    >;
    verifiedChannels: ExternalChannel[];
  }>;
  setPreference(input: {
    userId: UserId;
    category: NotificationCategory;
    channel: ExternalChannel;
    optedOut: boolean;
    operation: OperationContext;
  }): Promise<void>;
  createQueues(workerId: string): {
    expansion: QueueRunner;
    dispatch: QueueRunner;
    whatsappInbound: QueueRunner;
    outboundWhatsApp: QueueRunner;
  };
  enqueue(
    intents: NotificationIntent[],
    operation: OperationContext,
  ): Promise<void>;
  webhooks: {
    verifyWhatsAppSubscription(input: {
      mode: string | null;
      token: string | null;
    }): boolean;
    receiveKapso: (
      input: Parameters<typeof receiveKapsoWebhook>[1],
      operation: OperationContext,
    ) => ReturnType<typeof receiveKapsoWebhook>;
  };
}

export function assembleNotificationPipeline(
  deps: NotificationPipelineDeps,
): NotificationPipeline {
  const intents = createIntentRepository(deps.db);
  const deliveries = createDeliveryRepository(deps.db);
  const appNotifications = createAppNotificationRepo(deps.db);
  const preferences = createNotificationOptOutRepo(deps.db);
  const channelAddresses = createUserChannelAddressRepo(deps.db);

  const expand = createIntentExpander({
    planRecipients: createRecipientPlanner(deps.db, deps.logger),
    appNotifications,
    deliveries,
    logger: deps.logger,
  });
  const send = createDeliverySender({
    messaging: deps.messaging,
    publicOrigin: deps.publicOrigin,
    logger: deps.logger,
  });

  return {
    messaging: deps.messaging,
    async getHeader(userId, limit) {
      const [unreadCount, notifications] = await Promise.all([
        appNotifications.countUnreadByUser(userId),
        appNotifications.listByUser(userId, limit),
      ]);
      return { unreadCount, notifications };
    },
    async markRead(userId, notificationId, operation) {
      await appNotifications.markRead(
        userId,
        notificationId,
        operation.operationAt,
      );
    },
    async markAllRead(userId, operation) {
      await appNotifications.markAllRead(userId, operation.operationAt);
    },
    async listPreferences(userId) {
      const [optOuts, verifiedChannels] = await Promise.all([
        preferences.listForUser(userId),
        channelAddresses.listVerifiedChannels(userId),
      ]);
      return { optOuts, verifiedChannels };
    },
    async setPreference({ operation, ...preference }) {
      await preferences.setOptedOut({
        ...preference,
        changedAt: operation.operationAt,
      });
    },
    createQueues(workerId) {
      return {
        expansion: createIntentExpansionQueue(workerId, {
          intents,
          expand,
        }),
        dispatch: createDeliveryDispatchQueue(workerId, {
          deliveries,
          send,
        }),
        whatsappInbound: createWhatsAppInboundQueue(deps.db, workerId),
        outboundWhatsApp: createOutboundWhatsAppQueue(
          deps.db,
          deps.messaging,
          workerId,
        ),
      };
    },
    enqueue(intentsToEnqueue, operation) {
      return enqueueNotifications(
        deps.db,
        intentsToEnqueue,
        operation.operationAt,
      );
    },
    webhooks: {
      verifyWhatsAppSubscription({ mode, token }) {
        return (
          mode === "subscribe" && token === deps.whatsappWebhookVerifyToken
        );
      },
      receiveKapso: (input, operation) =>
        receiveKapsoWebhook(deps.db, input, operation),
    },
  };
}

export function createNotificationsRuntime(
  serverInfrastructure: ServerInfrastructure,
  config: NotificationsConfig,
  app: AppConfig,
): NotificationPipeline {
  const logger = createLogger("notifications");
  const providers: DeliveryProvider[] = [];
  if (config.resend) {
    providers.push(createResendProvider(config.resend));
  }

  if (Object.values(config.routes).includes("log")) {
    // `log` route: write the composed email to the log instead of sending it,
    // for dev and e2e.
    providers.push(
      createLogProvider((mail) => {
        logger.info("email.logged", {
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
        });
      }),
    );
  }

  if (config.kapso) {
    providers.push(
      createKapsoProvider({
        apiKey: config.kapso.apiKey,
        phoneNumberId: config.kapso.whatsappPhoneNumberId,
        metaGraphVersion: config.kapso.metaGraphVersion,
      }),
    );
  }

  if (config.whatsappCloud) {
    providers.push(createWhatsAppCloudProvider(config.whatsappCloud));
  }

  const channels = createMessageChannels({ routes: config.routes, providers });
  const messaging = createMessagingGateway({
    channels,
    composer: createEmailComposer(),
  });

  return assembleNotificationPipeline({
    db: serverInfrastructure.db,
    messaging,
    publicOrigin: app.publicOrigin,
    logger,
    whatsappWebhookVerifyToken: config.whatsappWebhookVerifyToken,
  });
}

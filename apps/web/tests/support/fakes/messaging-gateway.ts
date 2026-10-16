import type {
  DeliveryError,
  DeliveryProviderId,
  DeliveryReceipt,
  NotificationChannel,
  Result,
} from "@crm/message-channels";

import type { MessagingGateway } from "~/server/notifications/channels/messaging-gateway";

type SendResult = Result<DeliveryReceipt, DeliveryError>;

export function okReceipt(
  channel: NotificationChannel,
  provider: DeliveryProviderId,
  providerMessageId: string,
): SendResult {
  return { ok: true, value: { channel, provider, providerMessageId } };
}

// A transient provider failure (rate limit, 5xx). The dispatch stage should
// reschedule it with backoff rather than mark it failed.
export function retryableProviderError(
  channel: NotificationChannel,
  provider: DeliveryProviderId,
  statusCode = 429,
): SendResult {
  return {
    ok: false,
    error: {
      kind: "provider_error",
      channel,
      provider,
      code: "rate_limited",
      statusCode,
      message: "rate limited",
      retryable: true,
    },
  };
}

// A terminal provider failure (bad address, rejected template). No retry.
export function terminalProviderError(
  channel: NotificationChannel,
  provider: DeliveryProviderId,
  statusCode = 400,
): SendResult {
  return {
    ok: false,
    error: {
      kind: "provider_error",
      channel,
      provider,
      code: "bad_request",
      statusCode,
      message: "permanently rejected",
      retryable: false,
    },
  };
}

const DEFAULT_EMAIL = okReceipt("email", "resend", "test-email");
const DEFAULT_WHATSAPP = okReceipt(
  "whatsapp",
  "whatsapp_cloud",
  "test-whatsapp",
);

// A full MessagingGateway whose campaign-email and WhatsApp sends can be
// scripted per call. An empty script returns success, so existing happy-path
// tests need no setup. The three auth emails are not part of the notification
// pipeline and always succeed.
export function createScriptedMessagingGateway() {
  const emailScript: SendResult[] = [];
  const whatsAppScript: SendResult[] = [];
  const campaignEmails: Array<{
    to: string;
    params: Parameters<MessagingGateway["sendCampaignEmail"]>[0]["params"];
  }> = [];
  const whatsAppMessages: Array<{ to: string; body: string }> = [];

  const gateway: MessagingGateway = {
    async sendInviteEmail() {
      return DEFAULT_EMAIL;
    },
    async sendPasswordResetEmail() {
      return DEFAULT_EMAIL;
    },
    async sendAccountExpiringEmail() {
      return DEFAULT_EMAIL;
    },
    async sendCampaignEmail(input) {
      campaignEmails.push(input);
      return emailScript.shift() ?? DEFAULT_EMAIL;
    },
    async sendWhatsAppText(input) {
      whatsAppMessages.push(input);
      return whatsAppScript.shift() ?? DEFAULT_WHATSAPP;
    },
  };

  return {
    gateway,
    campaignEmails,
    whatsAppMessages,
    scriptEmail(...results: SendResult[]) {
      emailScript.push(...results);
    },
    scriptWhatsApp(...results: SendResult[]) {
      whatsAppScript.push(...results);
    },
  };
}

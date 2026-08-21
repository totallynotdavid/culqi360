import type { APIEvent } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import { getRequestOperation } from "~/server/platform/http/request-context-storage";
import { createLogger } from "~/shared/observability/runtime-logger";

const logger = createLogger("whatsapp-webhook");

export function GET(event: APIEvent): Response {
  const url = new URL(event.request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    challenge &&
    getApplication().notifications.webhooks.verifyWhatsAppSubscription({
      mode,
      token,
    })
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(event: APIEvent): Promise<Response> {
  try {
    const result = await getApplication().notifications.webhooks.receiveKapso(
      {
        idempotencyKey: event.request.headers.get("x-idempotency-key"),
        eventType: event.request.headers.get("x-webhook-event"),
        payloadVersion: event.request.headers.get("x-webhook-payload-version"),
        rawBody: await event.request.text(),
      },
      getRequestOperation(),
    );

    if (!result.ok) {
      logger.warn("whatsapp_webhook_rejected", { reason: result.error });
      return new Response("Bad Request", { status: 400 });
    }

    logger.info("whatsapp_webhook_received", { receipt: result.value });
    return new Response("OK", { status: 200 });
  } catch (error) {
    logger.error("whatsapp_webhook_receipt_failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("Service Unavailable", { status: 503 });
  }
}

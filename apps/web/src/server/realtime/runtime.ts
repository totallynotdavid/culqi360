import type { AuthSession } from "~/domain/auth/access/session-types";
import {
  createPgListener,
  type PgListenerHandler,
} from "~/server/platform/database/notifications/listener";
import { createLogger } from "~/shared/observability/runtime-logger";
import { Err, Ok, type Result } from "~/shared/result";

import type { RealtimeChannel } from "./channel";
import { openRealtimeStream } from "./stream";
import { TopicHub } from "./topic-hub";

// Keep idle streams alive through proxies.
const PING_INTERVAL_MS = 20_000;

// Force periodic reconnects so authorization is checked again.
const MAX_STREAM_AGE_MS = 15 * 60_000;

const logger = createLogger("realtime");

export type RealtimeOpenError = "unauthenticated" | "not_found" | "unavailable";

export interface RealtimeOpenRequest {
  channel: string;
  id: string;
  cursor: string | null;
}

export interface RealtimeService {
  start(): void;
  stop(): Promise<void>;
  /**
   * The caller supplies the session because middleware already resolved it onto
   * the request context; resolving it again here would drag the request event
   * through the whole subsystem.
   */
  openStream(
    session: AuthSession | null,
    request: RealtimeOpenRequest,
  ): Promise<Result<Response, RealtimeOpenError>>;
}

export function createRealtimeService(input: {
  channels: readonly RealtimeChannel[];
  databaseUrl: () => string;
}): RealtimeService {
  const hub = new TopicHub();
  let sweepTimer: ReturnType<typeof setInterval> | null = null;

  function broadcastPayload(channel: RealtimeChannel, payload: string): void {
    const topic = channel.topicOfPayload(payload);

    if (topic === null) {
      return;
    }

    // The writer owns the serialized browser payload.
    hub.broadcast(topic, {
      data: payload,
      id: channel.cursorOf(payload),
    });
  }

  function listenerHandlers(): Record<string, PgListenerHandler[]> {
    const handlers: Record<string, PgListenerHandler[]> = {};

    for (const channel of input.channels) {
      const existing = handlers[channel.pgChannel] ?? [];

      existing.push((payload) => broadcastPayload(channel, payload));
      handlers[channel.pgChannel] = existing;
    }

    return handlers;
  }

  const listener = createPgListener(input.databaseUrl, listenerHandlers(), {
    // A reconnect can miss notifications. Every stream then reconnects and
    // reads its current state again.
    onConnected: () => hub.closeAll(),
    onDisconnected: () => hub.closeAll(),
  });

  function start(): void {
    listener.start();

    if (sweepTimer !== null) {
      return;
    }

    sweepTimer = setInterval(
      () => hub.sweep(performance.now(), MAX_STREAM_AGE_MS),
      PING_INTERVAL_MS,
    );
    sweepTimer.unref();

    logger.info("realtime_starting", {
      channels: input.channels.map((channel) => channel.name),
    });
  }

  async function stop(): Promise<void> {
    if (sweepTimer !== null) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }

    hub.closeAll();
    await listener.stop();
  }

  async function openStream(
    session: AuthSession | null,
    request: RealtimeOpenRequest,
  ): Promise<Result<Response, RealtimeOpenError>> {
    if (!session || session.sessionClass !== "app") {
      return Err("unauthenticated");
    }

    const channel = input.channels.find(({ name }) => name === request.channel);

    if (!channel) {
      return Err("not_found");
    }

    const entry = channel.entry(request.id, session);

    if (!entry) {
      return Err("not_found");
    }

    if (!listener.isConnected()) {
      return Err("unavailable");
    }

    const stream = await openRealtimeStream(hub, entry, request.cursor);

    return stream ? Ok(stream) : Err("not_found");
  }

  return {
    start,
    stop,
    openStream,
  };
}

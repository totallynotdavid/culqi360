import { Client } from "pg";

import { createLogger } from "~/shared/observability/runtime-logger";

const logger = createLogger("pg-notify");

export type PgListenerHandler = (payload: string) => void;

export interface PgListener {
  start(): void;
  stop(): Promise<void>;
  isConnected(): boolean;
}

export interface PgListenerOptions {
  onConnected?: () => void | Promise<void>;
  onDisconnected?: () => void | Promise<void>;
}

const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 10_000;

function withJitter(delayMs: number): number {
  return delayMs * (0.5 + Math.random());
}

function reportListenerHook(
  name: "connected" | "disconnected",
  hook: (() => void | Promise<void>) | undefined,
): void {
  void Promise.resolve(hook?.()).catch((error: unknown) => {
    logger.error(`listener_on${name}_failed`, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  });
}

export function createPgListener(
  resolveConnectionString: () => string,
  channels: Record<string, PgListenerHandler[]>,
  options: PgListenerOptions = {},
): PgListener {
  // LISTEN subscriptions belong to one client connection.
  let client: Client | null = null;
  let stopped = true;
  let connecting = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connected = false;
  let reconnectDelayMs = RECONNECT_BASE_DELAY_MS;

  function scheduleReconnect(): void {
    if (stopped || connecting || reconnectTimer !== null) {
      return;
    }

    const delay = reconnectDelayMs;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MAX_DELAY_MS);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, withJitter(delay));
  }

  function disconnect(): void {
    const current = client;
    client = null;

    if (connected) {
      connected = false;
      reportListenerHook("disconnected", options.onDisconnected);
    }

    if (current) {
      void current.end().catch(() => {
        // Closing an errored or already-ended client can reject.
      });
    }

    scheduleReconnect();
  }

  async function connect(): Promise<void> {
    if (stopped || connecting || client) {
      return;
    }

    connecting = true;
    const next = new Client({ connectionString: resolveConnectionString() });
    client = next;

    next.on("notification", (message) => {
      const handlers = channels[message.channel];
      if (!handlers) {
        return;
      }

      for (const handler of handlers) {
        try {
          handler(message.payload ?? "");
        } catch (error: unknown) {
          logger.error("listener_handler_failed", {
            channel: message.channel,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    });
    next.on("error", (error: unknown) => {
      logger.error("listener_connection_error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      if (client === next) {
        disconnect();
      }
    });
    next.on("end", () => {
      if (client === next) {
        disconnect();
      }
    });

    let retry = false;

    try {
      await next.connect();
      // PostgreSQL drops subscriptions when the connection closes, so register
      // every channel on each connection.
      for (const channel of Object.keys(channels)) {
        // eslint-disable-next-line no-await-in-loop
        await next.query(`LISTEN "${channel}"`);
      }

      if (stopped) {
        await next.end();
        return;
      }

      connected = true;
      reconnectDelayMs = RECONNECT_BASE_DELAY_MS;
      logger.info("listener_connected", { channels: Object.keys(channels) });
      reportListenerHook("connected", options.onConnected);
    } catch (error: unknown) {
      logger.error("listener_connect_failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      await next.end().catch(() => {
        // Cleanup can reject after setup fails or the listener stops.
      });
      if (client === next) {
        client = null;
      }
      retry = true;
    } finally {
      connecting = false;
    }

    if (retry) {
      scheduleReconnect();
    }
  }

  return {
    start() {
      if (!stopped) {
        return;
      }
      stopped = false;
      void connect();
    },
    async stop() {
      stopped = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const current = client;
      client = null;
      connected = false;
      if (current) {
        await current.end();
      }
    },
    isConnected: () => connected,
  };
}

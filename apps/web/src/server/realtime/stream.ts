import type { RealtimeMessage } from "~/contracts/realtime/channel";

import type { RealtimePeer, TopicHub } from "./topic-hub";

export interface RealtimeSink {
  send: (messages: RealtimeMessage[]) => void;
  ping: () => void;
  close: () => void;
  onClosed: (listener: () => void) => void;
}

interface StreamEntry {
  topic: string;
  open: (cursor: string | null) => Promise<RealtimeMessage[] | null>;
}

// Subscribe before reading the opening state so broadcasts received during the
// read can be buffered and appended afterward.
export async function attachRealtimeSubscription(
  hub: TopicHub,
  sink: RealtimeSink,
  entry: StreamEntry,
  cursor: string | null,
): Promise<boolean> {
  let pending: RealtimeMessage[] | null = [];

  const peer: RealtimePeer = {
    send: (message) => {
      if (pending) {
        pending.push(message);
        return;
      }

      sink.send([message]);
    },
    ping: () => sink.ping(),
    close: () => sink.close(),
  };

  // Every exit closes the sink, making its close handler the sole owner of
  // removing the peer.
  hub.subscribe(peer, entry.topic, performance.now());
  sink.onClosed(() => hub.remove(peer));

  const opening = await entry.open(cursor).catch((error: unknown) => {
    sink.close();
    throw error;
  });

  if (opening === null) {
    sink.close();
    return false;
  }

  const buffered = pending;

  // These operations must remain synchronous and adjacent so broadcasts cannot
  // overtake the buffered opening state.
  pending = null;
  sink.send([...opening, ...buffered]);

  return true;
}

const encoder = new TextEncoder();

function encodeFrame(message: RealtimeMessage): string {
  const id = message.id ? `id: ${message.id}\n` : "";
  return `${id}data: ${message.data}\n\n`;
}

interface SseStream {
  sink: RealtimeSink;
  body: ReadableStream<Uint8Array>;
}

/**
 * A `text/event-stream` body over web streams, replacing H3's `createEventStream`.
 *
 * The consumer cancelling the stream is what a client disconnect looks like
 * here, so `cancel` is the close signal the hub needs to drop the peer. Writes
 * after close are dropped rather than thrown: broadcasts race disconnects by
 * nature, and the hub removes the peer on the same signal.
 */
function createSseStream(): SseStream {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const closedListeners = new Set<() => void>();
  let closed = false;

  function markClosed(): void {
    if (closed) {
      return;
    }

    closed = true;
    controller = null;

    for (const listener of closedListeners) {
      listener();
    }

    closedListeners.clear();
  }

  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
    cancel() {
      markClosed();
    },
  });

  function write(chunk: string): void {
    if (!controller) {
      return;
    }

    try {
      controller.enqueue(encoder.encode(chunk));
    } catch {
      markClosed();
    }
  }

  return {
    body,

    sink: {
      send: (messages) => write(messages.map(encodeFrame).join("")),
      ping: () => write(": ping\n\n"),

      close: () => {
        const open = controller;
        markClosed();

        try {
          open?.close();
        } catch {
          // Already closed by the consumer.
        }
      },

      onClosed: (listener) => {
        if (closed) {
          listener();
          return;
        }

        closedListeners.add(listener);
      },
    },
  };
}

// Access denial returns null so the caller decides the status code.
export async function openRealtimeStream(
  hub: TopicHub,
  entry: StreamEntry,
  cursor: string | null,
): Promise<Response | null> {
  const { sink, body } = createSseStream();

  const attached = await attachRealtimeSubscription(hub, sink, entry, cursor);

  if (!attached) {
    return null;
  }

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tells nginx and similar proxies not to buffer the stream.
      "X-Accel-Buffering": "no",
    },
  });
}

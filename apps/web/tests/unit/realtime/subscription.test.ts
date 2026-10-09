import { describe, expect, it, vi } from "vitest";

import type { RealtimeMessage } from "~/contracts/realtime/channel";
import {
  attachRealtimeSubscription,
  type RealtimeSink,
} from "~/server/realtime/stream";
import { TopicHub } from "~/server/realtime/topic-hub";

const TOPIC = "records-import.job-1";

interface FakeSink extends RealtimeSink {
  sent: RealtimeMessage[];
  closed: boolean;
}

// Records what reached the wire and in which order, and reports closure through
// onClosed, which is what evicts the peer.
function createFakeSink(): FakeSink {
  const listeners: (() => void)[] = [];

  const sink: FakeSink = {
    sent: [],
    closed: false,
    send: (messages) => sink.sent.push(...messages),
    ping: () => {},
    close: () => {
      sink.closed = true;
      for (const listener of listeners.splice(0)) {
        listener();
      }
    },
    onClosed: (listener) => listeners.push(listener),
  };

  return sink;
}

type StreamEntry = {
  topic: string;
  open: (cursor: string | null) => Promise<RealtimeMessage[] | null>;
};

function entryReading(read: StreamEntry["open"]): StreamEntry {
  return { topic: TOPIC, open: read };
}

describe("attachRealtimeSubscription", () => {
  it("sends the opening state before a broadcast that arrived while it was reading", async () => {
    const hub = new TopicHub();
    const sink = createFakeSink();

    // The broadcast lands mid-read, which is the window the buffer exists for.
    const entry = entryReading(async () => {
      hub.broadcast(TOPIC, { data: "live" });
      return [{ data: "opening" }];
    });

    await attachRealtimeSubscription(hub, sink, entry, null);

    expect(sink.sent).toEqual([{ data: "opening" }, { data: "live" }]);
  });

  it("passes the cursor to the opening read and forwards event ids", async () => {
    const hub = new TopicHub();
    const sink = createFakeSink();
    const read = vi.fn<StreamEntry["open"]>(async (cursor) => [
      { data: `from:${cursor ?? "start"}`, id: "cursor-2" },
    ]);

    await attachRealtimeSubscription(hub, sink, entryReading(read), "cursor-1");

    expect(read).toHaveBeenCalledWith("cursor-1");
    expect(sink.sent).toEqual([{ data: "from:cursor-1", id: "cursor-2" }]);
  });

  it("delivers later broadcasts straight through", async () => {
    const hub = new TopicHub();
    const sink = createFakeSink();

    await attachRealtimeSubscription(
      hub,
      sink,
      entryReading(async () => []),
      null,
    );
    hub.broadcast(TOPIC, { data: "later" });

    expect(sink.sent).toEqual([{ data: "later" }]);
  });

  it("writes nothing and drops the subscription when access is denied", async () => {
    const hub = new TopicHub();
    const sink = createFakeSink();

    const attached = await attachRealtimeSubscription(
      hub,
      sink,
      entryReading(async () => null),
      null,
    );
    hub.broadcast(TOPIC, { data: "live" });

    expect(attached).toBe(false);
    expect(sink.closed).toBe(true);
    expect(sink.sent).toEqual([]);
  });

  it("drops the subscription when the opening read throws", async () => {
    const hub = new TopicHub();
    const sink = createFakeSink();

    const entry = entryReading(() => Promise.reject(new Error("db down")));

    await expect(
      attachRealtimeSubscription(hub, sink, entry, null),
    ).rejects.toThrow("db down");

    hub.broadcast(TOPIC, { data: "live" });

    expect(sink.closed).toBe(true);
    expect(sink.sent).toEqual([]);
  });

  it("stops delivering once the stream reports closed", async () => {
    const hub = new TopicHub();
    const sink = createFakeSink();

    await attachRealtimeSubscription(
      hub,
      sink,
      entryReading(async () => []),
      null,
    );

    sink.close();
    hub.broadcast(TOPIC, { data: "after close" });

    expect(sink.sent).toEqual([]);
  });
});

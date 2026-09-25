import { createSignal, type Accessor } from "solid-js";

import type { RealtimeChannelName } from "~/contracts/realtime/channel";

import type { ConnectionState } from "./connection-lifecycle";
import { createTopicConnection } from "./create-topic-connection";

interface TopicFeedOptions<T> {
  channel: RealtimeChannelName;
  id: Accessor<string | null>;
  parse: (raw: string) => T | null;
  limit: number;
  resetKey?: Accessor<unknown>;
}

export function createTopicFeed<T>({
  channel,
  id,
  parse,
  limit,
  resetKey,
}: TopicFeedOptions<T>): {
  records: Accessor<T[]>;
  connection: Accessor<ConnectionState>;
} {
  const [records, setRecords] = createSignal<T[]>(() => {
    resetKey?.();

    return [];
  });

  const connection = createTopicConnection({
    channel,
    id,
    onMessage: (message) => {
      const parsed = parse(message.data);

      if (parsed === null) {
        return;
      }

      setRecords((previous) => [parsed, ...previous].slice(0, limit));
    },
  });

  return { records, connection };
}

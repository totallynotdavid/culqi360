import { createSignal, type Accessor } from "solid-js";

import type { RealtimeChannelName } from "~/contracts/realtime/channel";

import type { ConnectionState } from "./connection-lifecycle";
import { createTopicConnection } from "./create-topic-connection";

interface TopicStateOptions<T> {
  channel: RealtimeChannelName;
  id: Accessor<string | null>;
  parse: (raw: string) => T | null;

  // Close the connection once the value can no longer change.
  isFinal?: (value: T) => boolean;
}

export function createTopicState<T>(options: TopicStateOptions<T>): {
  value: Accessor<T | undefined>;
  connection: Accessor<ConnectionState>;
} {
  // Both are writable memos keyed on the topic: switching id recomputes them,
  // so a new topic never starts on the previous one's last message.
  const [value, setValue] = createSignal<T | undefined>(() => {
    options.id();

    return undefined;
  });

  const [final, setFinal] = createSignal(() => {
    options.id();

    return false;
  });

  const connection = createTopicConnection({
    channel: options.channel,
    id: options.id,
    stopped: final,
    onMessage: (message) => {
      const parsed = options.parse(message.data);

      if (parsed === null) {
        return;
      }

      setValue(() => parsed);

      if (options.isFinal?.(parsed)) {
        setFinal(true);
      }
    },
  });

  return { value, connection };
}

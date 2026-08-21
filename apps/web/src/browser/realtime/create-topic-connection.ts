import { createEffect, createSignal, type Accessor } from "solid-js";

import type {
  RealtimeChannelName,
  RealtimeMessage,
} from "~/contracts/realtime/channel";

import { startConnection, type ConnectionState } from "./connection-lifecycle";
import { readRealtimeStream } from "./read-realtime-stream";

interface TopicConnectionOptions {
  channel: RealtimeChannelName;

  // Null disconnects until a target is provided.
  id: Accessor<string | null>;

  onMessage: (message: RealtimeMessage) => void;

  // Prevents reconnecting after the target reaches a terminal state.
  stopped?: Accessor<boolean>;
}

export function createTopicConnection(
  options: TopicConnectionOptions,
): Accessor<ConnectionState> {
  const [state, setState] = createSignal<ConnectionState>("idle");

  createEffect(
    () => ({ id: options.id(), stopped: options.stopped?.() === true }),
    ({ id, stopped }) => {
      if (id === null || stopped) {
        setState("idle");
        return;
      }

      // Returned as the effect's cleanup, so the socket closes before the next
      // run reopens it on a new id.
      return startConnection({
        channel: options.channel,
        id,
        onMessage: options.onMessage,
        readStream: readRealtimeStream,
        setState,
      });
    },
  );

  return state;
}

export const REALTIME_CHANNELS = {
  // An unbounded stream of rows, which is a different shape from one entity's
  // lifecycle and so keeps its own channel.
  eventLogs: "event-logs",

  // Every kind of tracked server work. The kind travels in the subscription id
  // rather than in the channel name, so adding one costs a projector.
  jobs: "jobs",
} as const;

export type RealtimeChannelName =
  (typeof REALTIME_CHANNELS)[keyof typeof REALTIME_CHANNELS];

export interface RealtimeMessage {
  // Present only for resumable streams.
  id?: string;
  data: string;
}

export function realtimeStreamUrl(
  channel: RealtimeChannelName,
  id: string,
): string {
  return `/api/realtime/${channel}/${encodeURIComponent(id)}/stream`;
}

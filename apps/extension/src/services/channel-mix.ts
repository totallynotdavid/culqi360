export interface ChannelMix {
  /** Two channels: the microphone on the left, the tab on the right. */
  stream: MediaStream;
  close(): Promise<void>;
}

/**
 * Keep the layout equal to `EXTENSION_SEGMENT_CHANNEL_LAYOUT`. Capturing a tab
 * mutes it for the agent. The tab source must also play through `destination`
 * to restore the audio. Do not route the microphone there because the agent
 * would hear themselves.
 */
export async function mixChannels(input: {
  mic: MediaStream;
  tab: MediaStream;
}): Promise<ChannelMix> {
  const context = new AudioContext();
  try {
    await context.resume();
    if (context.state !== "running") {
      throw new Error(`audio context is ${context.state}`);
    }
  } catch (error: unknown) {
    await context.close();
    throw error;
  }

  const merger = context.createChannelMerger(2);
  const recording = context.createMediaStreamDestination();
  const mic = context.createMediaStreamSource(input.mic);
  const tab = context.createMediaStreamSource(input.tab);

  mic.connect(merger, 0, 0);
  tab.connect(merger, 0, 1);
  tab.connect(context.destination);
  merger.connect(recording);

  return { stream: recording.stream, close: () => context.close() };
}

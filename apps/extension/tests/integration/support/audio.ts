import type { Page } from "@playwright/test";

import { DATABASE_NAME } from "./extension-fixture";

export interface ChannelLevel {
  rms: number;
  peak: number;
  /** Amplitude of Chromium's 440 Hz fake microphone beep. */
  at440: number;
  /** Amplitude of the fake tab's 880 Hz tone. */
  at880: number;
}

export interface DecodedRecording {
  channels: number;
  seconds: number;
  left: ChannelLevel;
  right: ChannelLevel;
}

/**
 * Decodes the stored chunks of the only recording the way a listener's player
 * would: the chunks joined in order are one WebM file, and `decodeAudioData`
 * reports how many channels the Opus stream holds.
 */
export function decodeStoredRecording(page: Page): Promise<DecodedRecording> {
  return page.evaluate(async (databaseName) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const chunks = await new Promise<{ seq: number; blob: Blob }[]>(
      (resolve, reject) => {
        const request = database
          .transaction("chunks")
          .objectStore("chunks")
          .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );
    database.close();

    const ordered = chunks.sort((a, b) => a.seq - b.seq);
    const bytes = await new Blob(
      ordered.map((chunk) => chunk.blob),
    ).arrayBuffer();
    const context = new AudioContext();
    const audio = await context.decodeAudioData(bytes);
    await context.close();

    // Goertzel: the amplitude of one frequency in the whole channel.
    function amplitudeAt(samples: Float32Array, hz: number): number {
      const coefficient = 2 * Math.cos((2 * Math.PI * hz) / audio.sampleRate);
      let previous = 0;
      let beforePrevious = 0;
      for (const sample of samples) {
        const next = sample + coefficient * previous - beforePrevious;
        beforePrevious = previous;
        previous = next;
      }
      const power =
        previous * previous +
        beforePrevious * beforePrevious -
        coefficient * previous * beforePrevious;
      return (2 * Math.sqrt(Math.max(power, 0))) / samples.length;
    }

    function levelOf(index: number): ChannelLevel {
      const samples = audio.getChannelData(index);
      let sumOfSquares = 0;
      let peak = 0;
      for (const sample of samples) {
        sumOfSquares += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      return {
        rms: Math.sqrt(sumOfSquares / samples.length),
        peak,
        at440: amplitudeAt(samples, 440),
        at880: amplitudeAt(samples, 880),
      };
    }

    return {
      channels: audio.numberOfChannels,
      seconds: audio.duration,
      left: levelOf(0),
      right: levelOf(Math.min(1, audio.numberOfChannels - 1)),
    };
  }, DATABASE_NAME);
}

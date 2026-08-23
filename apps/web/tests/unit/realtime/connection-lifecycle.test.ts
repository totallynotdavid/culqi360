import { afterEach, describe, expect, it, vi } from "vitest";

import {
  startConnection,
  type ConnectionState,
} from "~/browser/realtime/connection-lifecycle";
import type {
  ReadRealtimeStreamParams,
  StreamOutcome,
} from "~/browser/realtime/read-realtime-stream";
import {
  REALTIME_CHANNELS,
  type RealtimeMessage,
} from "~/contracts/realtime/channel";

// One recorded connection attempt. The test resolves it to drive the outcome
// the lifecycle has to react to.
interface Attempt {
  params: ReadRealtimeStreamParams;
  end: (outcome: StreamOutcome) => void;
}

function connect() {
  const attempts: Attempt[] = [];
  const received: RealtimeMessage[] = [];
  const states: ConnectionState[] = [];

  const dispose = startConnection({
    channel: REALTIME_CHANNELS.jobs,
    id: "job-1",
    onMessage: (message) => received.push(message),
    setState: (state) => states.push(state),
    readStream: (params) =>
      new Promise<StreamOutcome>((resolve) => {
        attempts.push({ params, end: resolve });
      }),
  });

  function latest(): Attempt {
    const attempt = attempts.at(-1);

    if (!attempt) {
      throw new Error("no stream was opened");
    }

    return attempt;
  }

  return {
    attempts,
    received,
    states,
    latest,
    dispose,
    state: () => states.at(-1),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Reconnect delays are jittered so tabs do not come back in lockstep. Pinning
// the jitter to its midpoint makes the schedule exact: the factor becomes 1.
function useFixedJitter(): void {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
}

describe("startConnection", () => {
  it("opens the stream for its topic and reports live once it is open", () => {
    const connection = connect();

    expect(connection.latest().params.url).toBe(
      "/api/realtime/jobs/job-1/stream",
    );
    expect(connection.latest().params.cursor).toBeNull();

    connection.latest().params.onOpen();
    connection
      .latest()
      .params.onMessage({ data: '{"rows":1}', id: "cursor-1" });

    expect(connection.state()).toBe("live");
    expect(connection.received).toEqual([
      { data: '{"rows":1}', id: "cursor-1" },
    ]);

    connection.dispose();
  });

  it("resumes from the last cursor after the stream drops", async () => {
    vi.useFakeTimers();
    useFixedJitter();

    const connection = connect();

    connection.latest().params.onOpen();
    connection
      .latest()
      .params.onMessage({ data: '{"rows":1}', id: "cursor-1" });
    connection.latest().end({ kind: "failed" });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(connection.attempts).toHaveLength(2);
    expect(connection.latest().params.cursor).toBe("cursor-1");

    connection.dispose();
  });

  // A refused stream is refused for a reason retrying cannot change. This is
  // the case the fetch transport exists to detect.
  it("stops for good once the server refuses the stream", async () => {
    vi.useFakeTimers();

    const connection = connect();

    connection.latest().end({ kind: "denied", status: 401 });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(connection.state()).toBe("denied");
    expect(connection.attempts).toHaveLength(1);

    connection.dispose();
  });

  // The server caps stream age and closes every peer after a missed
  // notification, so a clean close is routine and must not look like an outage.
  it("reopens after a clean close without reporting offline", async () => {
    vi.useFakeTimers();
    useFixedJitter();

    const connection = connect();

    connection.latest().params.onOpen();
    connection.latest().end({ kind: "closed" });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(connection.attempts).toHaveLength(2);
    expect(connection.states).not.toContain("offline");

    connection.dispose();
  });

  // A tab whose server is down has to settle into a slow retry instead of
  // hammering the route.
  it("backs off exponentially up to the cap while the stream keeps failing", async () => {
    vi.useFakeTimers();
    useFixedJitter();

    const connection = connect();
    const schedule = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000];

    for (const [attempt, delay] of schedule.entries()) {
      connection.latest().end({ kind: "failed" });

      // Let the awaited outcome settle before inspecting the timer.
      // eslint-disable-next-line no-await-in-loop
      await vi.advanceTimersByTimeAsync(0);
      expect(connection.state()).toBe("offline");

      // One tick short of the delay nothing has reopened yet, which is what
      // makes this a test of the schedule and not just of eventual retry.
      // eslint-disable-next-line no-await-in-loop
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(connection.attempts).toHaveLength(attempt + 1);

      // eslint-disable-next-line no-await-in-loop
      await vi.advanceTimersByTimeAsync(1);
      expect(connection.attempts).toHaveLength(attempt + 2);
    }

    connection.dispose();
  });

  it("resets the backoff after a stream opens successfully", async () => {
    vi.useFakeTimers();
    useFixedJitter();

    const connection = connect();

    // Climb to an 8 second delay, then let a stream open.
    for (const delay of [1_000, 2_000, 4_000]) {
      connection.latest().end({ kind: "failed" });
      // eslint-disable-next-line no-await-in-loop
      await vi.advanceTimersByTimeAsync(delay);
    }

    connection.latest().params.onOpen();

    const beforeLastFailure = connection.attempts.length;
    connection.latest().end({ kind: "failed" });
    await vi.advanceTimersByTimeAsync(1_000);

    // Without the reset the next attempt would still be 8 seconds away.
    expect(connection.attempts).toHaveLength(beforeLastFailure + 1);

    connection.dispose();
  });

  it("aborts the stream and cancels a pending reconnect when disposed", async () => {
    vi.useFakeTimers();

    const connection = connect();
    const { signal } = connection.latest().params;

    connection.latest().end({ kind: "failed" });
    await vi.advanceTimersByTimeAsync(0);
    const opened = connection.attempts.length;

    connection.dispose();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(signal.aborted).toBe(true);
    expect(connection.attempts).toHaveLength(opened);
  });
});

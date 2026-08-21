import { makeAuthSession } from "@tests/support/unit/factories";
import { describe, expect, it } from "vitest";

import {
  realtimeStreamUrl,
  REALTIME_CHANNELS,
} from "~/contracts/realtime/channel";
import { defineRealtimeChannel } from "~/server/realtime/channel";

const session = makeAuthSession({ role: "admin" });

function testChannel(options: { authorized: boolean }) {
  return defineRealtimeChannel({
    name: REALTIME_CHANNELS.jobs,
    pgChannel: "test-channel",
    parseId: (raw) => (raw.startsWith("job-") ? raw : null),
    open: async (_session, id, cursor) =>
      options.authorized ? [{ data: `${id}:${cursor ?? "none"}` }] : null,
    topicIdOfPayload: (payload) => {
      const parsed: unknown = JSON.parse(payload);

      return typeof parsed === "object" && parsed !== null && "jobId" in parsed
        ? String(parsed.jobId)
        : null;
    },
    cursorOf: () => "cursor-1",
  });
}

describe("defineRealtimeChannel", () => {
  it("binds the opening read to the parsed id", async () => {
    const entry = testChannel({ authorized: true }).entry("job-7", session);

    expect(entry?.topic).toBe("jobs.job-7");
    expect(await entry?.open("cursor-9")).toEqual([{ data: "job-7:cursor-9" }]);
  });

  it("refuses an unparseable id and a denied id the same way", async () => {
    const granted = testChannel({ authorized: true });
    const denied = testChannel({ authorized: false });

    expect(granted.entry("nope", session)).toBeNull();
    expect(await denied.entry("job-7", session)?.open(null)).toBeNull();
  });

  it("routes a payload to its topic and drops unroutable payloads", () => {
    const channel = testChannel({ authorized: true });

    expect(channel.topicOfPayload(JSON.stringify({ jobId: "job-7" }))).toBe(
      "jobs.job-7",
    );
    expect(channel.topicOfPayload(JSON.stringify({ other: 1 }))).toBeNull();
  });
});

describe("realtimeStreamUrl", () => {
  it("escapes the id so it cannot break out of the path", () => {
    expect(realtimeStreamUrl(REALTIME_CHANNELS.eventLogs, "a/b")).toBe(
      "/api/realtime/event-logs/a%2Fb/stream",
    );
  });
});

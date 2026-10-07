# Realtime

Record-import progress, GPV report imports, and event logs all reach the browser
through one pipeline. Queue execution never depends on an active browser
connection.

## Publishing

A writer publishes with PostgreSQL `NOTIFY`. Each process holds a single
`LISTEN` connection covering every channel assembled in
[`application.ts`](../src/server/composition/application.ts), started lazily by
[`runtime.ts`](../src/server/realtime/runtime.ts) so processes that never serve
streams open no connection.

A channel is defined by
[`defineRealtimeChannel`](../src/server/realtime/channel.ts). It maps a payload
to a topic, optionally extracts a cursor from it, and defines one `open` that
authorizes the caller and reads the state a new subscriber needs in a single
query. `open` runs on every connect, which is what makes a reconnect lossless.
Returning `null` denies the subscription.

[`stream.ts`](../src/server/realtime/stream.ts) subscribes the peer before
calling `open`, buffering anything broadcast during the read and flushing it
after the opening state. Closing the sink is the only way a peer leaves the hub,
so eviction has exactly one owner.

## Transport

Browsers subscribe at `/api/realtime/:channel/:id/stream`. The response is
server-sent events, and the `text/event-stream` content type is load-bearing
rather than cosmetic: cloudflared buffers proxied responses unless the content
type is on its flushable list, so changing it would stall delivery in production
until each stream ended.

The client does not use `EventSource`. Per the HTML specification a non-200
response makes the browser "fail the connection", which fires a bare `Event`
with no status and never reconnects, so a session that expired and a proxy that
returned 502 for one second are indistinguishable. The only safe response is to
retry both forever.

Instead
[`read-realtime-stream.ts`](../src/browser/realtime/read-realtime-stream.ts)
drives the request with `fetch` and parses the frames with `eventsource-parser`,
which makes the response status readable and splits failures into two kinds:

| Response             | Outcome  | Client behavior                            |
| -------------------- | -------- | ------------------------------------------ |
| Clean end of stream  | `closed` | Reopens, without reporting an outage       |
| 401 or 404           | `denied` | Stops permanently                          |
| 5xx or network error | `failed` | Reopens with backoff and reports `offline` |

401 and 404 are terminal because neither answer changes by asking again: the
session is gone, or the topic is not this session's to read. `/api/realtime/` is
an API path, so an expired session is rejected with 401 by
[`request-auth.ts`](../src/server/platform/http/request-auth.ts) rather than
redirected to the login page.

[`connection-lifecycle.ts`](../src/browser/realtime/connection-lifecycle.ts)
owns the retry policy: jittered exponential backoff from one second to a thirty
second cap, reset once a stream opens. It reports `idle`, `connecting`, `live`,
`offline`, or `denied`.

## Consuming a topic

Features never open a stream directly. The
[`createTopicConnection`](../src/browser/realtime/create-topic-connection.ts)
primitive owns a topic's connection state. The
[`createTopicFeed`](../src/browser/realtime/create-topic-feed.ts) helper uses it
to accumulate a capped list and returns the records with the connection state,
because a surface that cannot see `offline` or `denied` renders stale data as if
it were current: a progress bar frozen at its last row count looks identical to
one that is simply between updates.

## Cursors and recovery

Resumable channels attach an id to each message, which is both the SSE event id
and the reconnect cursor. The client sends it back as `Last-Event-ID` on every
connect, including reconnects it opens itself, so the header is the only cursor
and one topic has exactly one stream URL.

Streams are closed rather than repaired. After a missed notification the
listener closes every stream, and streams are also closed once they pass a
fifteen minute age cap so authorization runs again. Clients reconnect on their
own and re-read their state through `open`.

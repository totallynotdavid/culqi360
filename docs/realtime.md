# Realtime

Record-import progress, merchant report imports, and event logs reach the
browser through one pipeline. Queue execution does not depend on an open browser
connection.

## Publishing

A writer publishes with PostgreSQL `NOTIFY`. Each process holds one `LISTEN`
connection that covers every channel assembled in
[`application.ts`](../apps/web/src/server/composition/application.ts).
[`runtime.ts`](../apps/web/src/server/realtime/runtime.ts) starts it lazily, so
a process that never serves streams opens no connection.

[`defineRealtimeChannel`](../apps/web/src/server/realtime/channel.ts) defines a
channel. It maps a payload to a topic, optionally extracts a cursor from the
payload, and supplies one `open` function. `open` authorizes the caller and
reads, in a single query, the state a new subscriber needs. It runs on every
connect, so a reconnect loses nothing. Returning `null` denies the subscription.

[`stream.ts`](../apps/web/src/server/realtime/stream.ts) subscribes the peer
before it calls `open`, buffers anything broadcast during the read, and flushes
the buffer after the opening state. A peer leaves the hub only when its sink
closes.

## Transport

Browsers subscribe at `/api/realtime/:channel/:id/stream`. The response is
server-sent events with the content type `text/event-stream`.

An expired session gets a 401 on this path from
[`request-auth.ts`](../apps/web/src/server/platform/http/request-auth.ts)
instead of a redirect to the login page.

[`read-realtime-stream.ts`](../apps/web/src/browser/realtime/read-realtime-stream.ts)
reads the stream with `fetch` and `eventsource-parser`. It reports one of three
outcomes:

| Response                                                         | Outcome  | Client behavior                            |
| ---------------------------------------------------------------- | -------- | ------------------------------------------ |
| Clean end of stream                                              | `closed` | Reopens, without reporting an outage       |
| 401 or 404                                                       | `denied` | Stops permanently                          |
| Any other non-OK status, a network error, or an error mid-stream | `failed` | Reopens with backoff and reports `offline` |

[`connection-lifecycle.ts`](../apps/web/src/browser/realtime/connection-lifecycle.ts)
sets the retry policy: jittered exponential backoff from one second to a
30-second cap, reset when a stream opens. The connection reports `idle`,
`connecting`, `live`, `offline`, or `denied`.

## Consuming a topic

Features consume a topic through
[`createTopicConnection`](../apps/web/src/browser/realtime/create-topic-connection.ts),
which owns the connection state, or through
[`createTopicFeed`](../apps/web/src/browser/realtime/create-topic-feed.ts),
which accumulates a capped list of records. Both return the connection state
with the data, so a view can show `offline` or `denied` instead of stale data
that looks current.

## Cursors and recovery

A resumable channel attaches an id to each message. The id is the SSE event id
and the reconnect cursor. The client sends it as `Last-Event-ID` on every
connect, including reconnects it opens itself, so the header is the only cursor
and a topic has one stream URL.

The server closes streams instead of repairing them. When the `LISTEN`
connection connects or disconnects, the listener closes every stream, because
notifications may have been missed. Streams also close after 15 minutes so that
authorization runs again. Clients reconnect and re-read their state through
`open`.

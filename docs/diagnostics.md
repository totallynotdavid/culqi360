# Diagnostics

Diagnostics trace server rendering, hydration, and requests while you develop.
They are separate from audit and operational logs.

Server channels use `DEBUG_DIAGNOSTICS`. Browser channels use
`VITE_DEBUG_DIAGNOSTICS`. Both take a comma-separated list of channels:

| Channel     | Output                                                    |
| ----------- | --------------------------------------------------------- |
| `ssr`       | Server rendering.                                         |
| `hydration` | Browser hydration.                                        |
| `requests`  | Request tracing in the Vite dev server. Server side only. |

`all` or `*` enables every channel. `DEBUG_DIAGNOSTICS_FILTER` and
`VITE_DEBUG_DIAGNOSTICS_FILTER` limit `ssr` and `hydration` output to the listed
scopes, written as `scope` or `channel:scope`.

```sh
DEBUG_DIAGNOSTICS=ssr bun run dev
VITE_DEBUG_DIAGNOSTICS=hydration bun run dev
DEBUG_DIAGNOSTICS=requests bun run dev
DEBUG_DIAGNOSTICS=requests DEBUG_DIAGNOSTICS_REQUESTS=verbose bun run dev
DEBUG_DIAGNOSTICS=requests DEBUG_DIAGNOSTICS_REQUESTS_SLOW_MS=500 bun run dev
```

Request tracing logs document navigations, server functions, API routes, non-GET
requests, failures (status 400 and above), slow responses, and aborted requests.
It skips asset traffic. The slow threshold defaults to 250 ms
(`DEBUG_DIAGNOSTICS_REQUESTS_SLOW_MS`). With
`DEBUG_DIAGNOSTICS_REQUESTS=verbose`, every request is logged, assets included.

The tracer is [`tracer.ts`](../apps/web/tracer.ts); the `ssr` and `hydration`
channels are in
[`diagnostics/`](../apps/web/src/browser/observability/diagnostics/).

# Diagnostics

Diagnostics trace hydration and dev-server requests while you develop. They are
separate from audit and operational logs.

`DEBUG_DIAGNOSTICS` takes a comma-separated list of channels. `*` or `all`
enables every channel.

| Channel     | Output                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| `hydration` | Browser hydration events: start, completion, window errors, unhandled rejections, and error-boundary catches. |
| `requests`  | One line per dev-server request, written by the Vite dev server.                                              |

The browser bundle cannot read server variables, so it reads the `VITE_` forms,
`VITE_DEBUG_DIAGNOSTICS` and `VITE_DEBUG_DIAGNOSTICS_FILTER`.

`DEBUG_DIAGNOSTICS_FILTER` limits `hydration` to a comma-separated list of
scopes. An entry is either a scope or `hydration:<scope>`.

```sh
VITE_DEBUG_DIAGNOSTICS=hydration bun run dev
DEBUG_DIAGNOSTICS=requests bun run dev
DEBUG_DIAGNOSTICS=requests DEBUG_DIAGNOSTICS_REQUESTS=verbose bun run dev
DEBUG_DIAGNOSTICS=requests DEBUG_DIAGNOSTICS_REQUESTS_SLOW_MS=500 bun run dev
```

## Request tracing

Request tracing logs document navigations, server functions, API routes, non-GET
requests, failures (status 400 and above), slow responses, and aborted requests.
It skips asset traffic. The slow threshold defaults to 250 ms
(`DEBUG_DIAGNOSTICS_REQUESTS_SLOW_MS`). With
`DEBUG_DIAGNOSTICS_REQUESTS=verbose`, every request is logged, assets included.

The tracer is [`tracer.ts`](../apps/web/tracer.ts). The `hydration` channel is
in [`diagnostics/`](../apps/web/src/browser/observability/diagnostics/).

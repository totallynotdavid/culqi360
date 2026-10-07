# Browser extension

The browser extension is the call companion for Culqi360. It tracks an
assignment and call lifecycle, records audio through the browser's offscreen
document, persists state locally, and queues events for synchronization with the
web application.

## Runtime

The service worker starts at
[`entrypoints/background.ts`](entrypoints/background.ts) and registers
[`src/background/runtime.ts`](src/background/runtime.ts). The runtime restores
state, ensures the sync alarm exists, handles internal and external messages,
updates the state model, and flushes queued jobs when a transition needs sync.

The state model and message contracts are
[`src/domain/model.ts`](src/domain/model.ts) and
[`src/domain/messages.ts`](src/domain/messages.ts). Popup and side-panel
entrypoints are under [`entrypoints/`](entrypoints/).

Durable state uses `browser.storage.local` through
[`src/services/storage.ts`](src/services/storage.ts). Large recording payloads
use IndexedDB through [`src/services/journal.ts`](src/services/journal.ts).
Queue and retry behavior are in
[`src/services/queue.ts`](src/services/queue.ts). Network delivery and session
refresh are in [`src/services/sync.ts`](src/services/sync.ts).

## Web handoff

The web application creates a signed handoff token and sends an
`assignment.handoff` message. The extension verifies the sender origin and
signature in [`src/services/external-auth.ts`](src/services/external-auth.ts),
then claims a session through the web API. Queued events use the web
extension-events API, and refresh uses the web session-refresh API.

`CRM_WEB_ORIGIN` configures build-time host permissions in
[`wxt.config.ts`](wxt.config.ts). The client runtime reads `VITE_CRM_WEB_ORIGIN`
and defaults to `http://localhost:3000`. It reads the verification key from
`VITE_CRM_HANDOFF_PUBLIC_KEY_RAW_BASE64`.

## Run and validate

Run these commands from `apps/extension/`:

```sh
bun run dev
bun run dev:firefox
bun run build
bun run zip
```

Run the type check and browser integration suite:

```sh
bun run check
bun run test:integration
```

The integration command builds the extension before running Playwright.

## First reads

Start with [`src/background/runtime.ts`](src/background/runtime.ts),
[`src/domain/model.ts`](src/domain/model.ts), and
[`src/domain/messages.ts`](src/domain/messages.ts). Then read
[`src/services/external-auth.ts`](src/services/external-auth.ts),
[`src/services/sync.ts`](src/services/sync.ts), and the web extension service at
[`apps/web/src/server/extension/service.ts`](../web/src/server/extension/service.ts).

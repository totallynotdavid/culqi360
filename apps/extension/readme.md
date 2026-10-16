# Browser extension

The browser extension is the call companion for Culqi360. It tracks an
assignment and call lifecycle, records the call tab through the browser's
offscreen document, keeps everything it captured on disk, and uploads it to the
web application. It targets Chromium browsers only.

[Architecture](../../docs/architecture.md#browser-extension) describes how it
stores, records and uploads, and the states it moves through.

## Code map

- [`entrypoints/background.ts`](entrypoints/background.ts) starts the service
  worker, which registers
  [`src/background/runtime.ts`](src/background/runtime.ts).
- [`entrypoints/offscreen/main.ts`](entrypoints/offscreen/main.ts) records the
  agent's microphone and the tab. Popup and side-panel entrypoints are also
  under [`entrypoints/`](entrypoints/).
- [`entrypoints/permission/main.ts`](entrypoints/permission/main.ts) is the
  visible page that asks for the microphone, since an offscreen document cannot.
- [`src/domain/model.ts`](src/domain/model.ts) and
  [`src/domain/messages.ts`](src/domain/messages.ts) hold the state model and
  the message contracts.
- [`src/services/`](src/services/) holds the database, the upload and the
  session. The wire contract with the web application is
  [`packages/contracts/src/extension.ts`](../../packages/contracts/src/extension.ts).

## Configuration

`CRM_WEB_ORIGIN` is the only variable a release build reads. It adds the web
origin to the manifest host permissions and the externally connectable list, and
`localhost` and `127.0.0.1` are always allowed. The sender's origin of a handoff
message becomes the origin every later request goes to.

## Run and validate

Run these commands from `apps/extension/`:

```sh
bun run dev
bun run build
bun run zip
```

Run the type check and browser integration suite:

```sh
bun run typecheck
bun run test:integration
```

The integration command builds the extension in test mode (`build:test` sets
`CRM_FAKE_TAB_CAPTURE=1`) and runs Playwright against Chromium with an in-memory
receiver. The test build replaces one module, `#tab-capture`
([`src/services/tab-capture.ts`](src/services/tab-capture.ts)), with
[`tab-capture.fake.ts`](src/services/tab-capture.fake.ts), because a headless
browser cannot be granted a tab-capture stream, and the fake returns a steady
880 Hz tone as the tab. The microphone is Chromium's fake device, and the tests
grant it to the extension origin with CDP `Browser.grantPermissions`. They do
not pass `--use-fake-ui-for-media-stream`, which breaks tab-capture
`getUserMedia`. Install the browser once with
`bunx playwright install chromium`.

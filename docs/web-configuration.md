# Web configuration

The web server and the maintenance worker read their settings from environment
variables. The development scripts load the repository-root `.env`, the test
scripts load `.env.test`, and `bun run build` loads `.env.production`. The
production scripts (`start`, `migrate:prod`, `provision:prod`,
`worker:maintenance:prod`) read the process environment.

[`env.ts`](../apps/web/src/server/platform/config/env.ts) is the canonical
server configuration. [`vite.config.ts`](../apps/web/vite.config.ts) and
[`runtime-env.ts`](../apps/web/src/shared/observability/runtime-env.ts) read
build and browser values directly.

Both processes call `validateServerConfig()` at startup. A variable marked
_Always_ below must be set, even in local development, or the process exits with
the name of the missing variable. Any non-empty value passes for the Google and
notification provider credentials, so placeholders are enough to run locally.

A secret passes the entropy check when it has at least 32 characters, at least
10 distinct characters, and is neither one repeated character nor a run of
sequential characters. `openssl rand -base64 32` produces one.

## Application and storage

| Variable                | Required when     | Default                    | Purpose                                                                            |
| ----------------------- | ----------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `APP_PUBLIC_ORIGIN`     | Optional          | `http://localhost:3000`    | Builds links in invitations and notifications.                                     |
| `TRUSTED_PROXY`         | Optional          | `false`                    | Trusts forwarded origin headers when set to `true`.                                |
| `WEB_DB_URL`            | Production        | Local `crm` database       | Connects the web server and worker to PostgreSQL.                                  |
| `WEB_UPLOADS_ROOT`      | Optional          | `.local-storage/documents` | Stores uploaded and generated files.                                               |
| `INSTALLATION_PASSWORD` | Installation seed | None                       | Sets the initial installation password and must contain at least eight characters. |

`APP_PUBLIC_ORIGIN` must be an HTTP or HTTPS origin with no path, query, or
fragment. Its default, `http://localhost:3000`, is where the development server
and the production server listen. Both read `PORT` (default 3000), and the
development server fails instead of choosing another port when `PORT` is taken.
If you change `PORT`, change `APP_PUBLIC_ORIGIN` and the other origin variables
to match.

Passkey registration and verification derive the relying-party ID and origin
from each request. Set `TRUSTED_PROXY=true` only behind a trusted proxy that
supplies the forwarded origin headers.

## Authentication and integrations

| Variable               | Required when | Default                 | Purpose                                                      |
| ---------------------- | ------------- | ----------------------- | ------------------------------------------------------------ |
| `SESSION_SECRET`       | Always        | None                    | Signs sessions. Must pass the secret-entropy check.          |
| `TOTP_ENCRYPTION_KEY`  | Always        | None                    | Encrypts TOTP data. Must pass the secret-entropy check.      |
| `RECOVERY_CODE_PEPPER` | Always        | None                    | Protects recovery codes. Must pass the secret-entropy check. |
| `ENGINE_HMAC_KEY_ID`   | Always        | None                    | Identifies the web key to the engine.                        |
| `ENGINE_HMAC_SECRET`   | Always        | None                    | Signs engine requests. Must pass the secret-entropy check.   |
| `ENGINE_CONNECT_MODE`  | Optional      | `local`                 | Selects `local`, `internal`, or `remote` URL validation.     |
| `ENGINE_URL`           | Optional      | `http://127.0.0.1:3001` | Sets the engine endpoint.                                    |
| `ENGINE_TIMEOUT_MS`    | Optional      | `5000`                  | Sets the engine request timeout.                             |
| `GOOGLE_CLIENT_ID`     | Always        | None                    | Configures the Google OAuth client.                          |
| `GOOGLE_CLIENT_SECRET` | Always        | None                    | Configures the Google OAuth secret.                          |
| `GOOGLE_REDIRECT_URI`  | Always        | None                    | Sets the OAuth callback URL.                                 |

The engine must hold the same secret under the same key ID in its
`ENGINE_HMAC_KEYS_JSON`. See the [engine guide](../crates/engine/readme.md).

Extension handoff uses `EXTENSION_EXPECTED_ORIGIN`,
`EXTENSION_HANDOFF_PRIVATE_KEY_PKCS8_BASE64`, and
`EXTENSION_HANDOFF_PUBLIC_KEY_SPKI_BASE64`. The origin defaults to
`http://localhost:3000`; both keys default to empty values.
[`.env.example`](../.env.example) shows how to generate the key pair.

## Notifications

`NOTIFICATION_ROUTES` maps channels to providers. The default is
`email:resend,whatsapp:kapso`. Omitting a channel disables it.

| Provider or boundary | Variables                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Resend               | `RESEND_API_KEY`, `EMAIL_FROM`                                                                           |
| Kapso                | `KAPSO_API_KEY`, `KAPSO_WHATSAPP_PHONE_NUMBER_ID`, optional `KAPSO_META_GRAPH_VERSION`                   |
| Meta Cloud           | `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, optional `WHATSAPP_CLOUD_GRAPH_VERSION` |
| WhatsApp webhook     | `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, optional `KAPSO_WEBHOOK_SECRET`                                         |

Provider credentials are required only when `NOTIFICATION_ROUTES` selects the
provider. `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is always required and must pass the
secret-entropy check.

## Observability

| Variable                                            | Default                                      | Purpose                                                                     |
| --------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| `VITE_SENTRY_DSN`                                   | Empty                                        | Sentry DSN for server and browser.                                          |
| `SENTRY_TRACES_SAMPLE_RATE`                         | `0.1`                                        | Server trace sample rate. The server initializes Sentry only in production. |
| `VITE_SENTRY_TRACES_SAMPLE_RATE`                    | `0.1`                                        | Browser trace sample rate.                                                  |
| `VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE`            | `0.05`                                       | Browser session replay sample rate.                                         |
| `VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE`           | `1.0`                                        | Browser replay sample rate for sessions with an error.                      |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | None                                         | Upload source maps during the build.                                        |
| `LOG_LEVEL`                                         | `debug` in development, `info` in production | Minimum log level (`debug`, `info`, `warn`, `error`).                       |
| `LOG_FORMAT`                                        | Unset                                        | `json` forces JSON output. Production always logs JSON.                     |

`VITE_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are
read at Vite build time, not only at container runtime. The browser DSN and the
other `VITE_SENTRY_*` values are compiled into the image, so changing them
requires a rebuild, and one image serves one Sentry project. The container build
must receive them as Docker build args. `compose.app.yml` passes them through
`build.args`; `environment:` or `env_file:` alone does not reach the build
stage.

The `DEBUG_DIAGNOSTICS*` variables are described in
[Diagnostics](diagnostics.md).

## Templates

[`.env.example`](../.env.example) lists the local values and
[`app.env.example`](../ops/deployment/app.env.example) the deployment values.

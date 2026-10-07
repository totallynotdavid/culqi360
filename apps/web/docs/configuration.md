# Web configuration

Local development reads environment values from the file selected by each
package script. Production reads them from the process environment.

[`src/server/platform/config/env.ts`](../src/server/platform/config/env.ts) is
the canonical server configuration. [`vite.config.ts`](../vite.config.ts) and
[`src/shared/observability/runtime-env.ts`](../src/shared/observability/runtime-env.ts)
read build and browser values directly.

## Application and storage

| Variable                | Required when     | Default                    | Purpose                                                                            |
| ----------------------- | ----------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `APP_PUBLIC_ORIGIN`     | Optional          | `http://localhost:3000`    | Builds links in invitations and notifications.                                     |
| `TRUSTED_PROXY`         | Optional          | `false`                    | Enables trusted-proxy request handling.                                            |
| `WEB_DB_URL`            | Production        | Local `crm` database       | Connects the web server and worker to PostgreSQL.                                  |
| `WEB_UPLOADS_ROOT`      | Optional          | `.local-storage/documents` | Stores uploaded and generated files.                                               |
| `INSTALLATION_PASSWORD` | Installation seed | None                       | Sets the initial installation password and must contain at least eight characters. |

`APP_PUBLIC_ORIGIN` must be an HTTP or HTTPS origin with no path, query, or
fragment.

Passkey registration and verification derive the relying-party ID and origin
from each request. Set `TRUSTED_PROXY=true` only behind a trusted proxy that
supplies the forwarded origin headers.

## Authentication and integrations

| Variable               | Required when         | Default                 | Purpose                                                      |
| ---------------------- | --------------------- | ----------------------- | ------------------------------------------------------------ |
| `SESSION_SECRET`       | Always                | None                    | Signs sessions. Must pass the secret-entropy check.          |
| `TOTP_ENCRYPTION_KEY`  | Always                | None                    | Encrypts TOTP data. Must pass the secret-entropy check.      |
| `RECOVERY_CODE_PEPPER` | Always                | None                    | Protects recovery codes. Must pass the secret-entropy check. |
| `ENGINE_HMAC_KEY_ID`   | Engine client is used | None                    | Identifies the web key to the engine.                        |
| `ENGINE_HMAC_SECRET`   | Engine client is used | None                    | Signs engine requests.                                       |
| `ENGINE_CONNECT_MODE`  | Optional              | `local`                 | Selects `local`, `internal`, or `remote` URL validation.     |
| `ENGINE_URL`           | Optional              | `http://127.0.0.1:3001` | Sets the engine endpoint.                                    |
| `ENGINE_TIMEOUT_MS`    | Optional              | `5000`                  | Sets the engine request timeout.                             |
| `GOOGLE_CLIENT_ID`     | Google OAuth is used  | None                    | Configures the Google OAuth client.                          |
| `GOOGLE_CLIENT_SECRET` | Google OAuth is used  | None                    | Configures the Google OAuth secret.                          |
| `GOOGLE_REDIRECT_URI`  | Google OAuth is used  | None                    | Sets the OAuth callback URL.                                 |

Extension handoff uses `EXTENSION_EXPECTED_ORIGIN`,
`EXTENSION_HANDOFF_PRIVATE_KEY_PKCS8_BASE64`, and
`EXTENSION_HANDOFF_PUBLIC_KEY_SPKI_BASE64`. The origin defaults to
`http://localhost:3000`; both keys default to empty values.

## Notifications

`NOTIFICATION_ROUTES` maps channels to providers. The default is
`email:resend,whatsapp:kapso`. Omitting a channel disables it.

| Provider or boundary | Variables                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Resend               | `RESEND_API_KEY`, `EMAIL_FROM`                                                                           |
| Kapso                | `KAPSO_API_KEY`, `KAPSO_WHATSAPP_PHONE_NUMBER_ID`, optional `KAPSO_META_GRAPH_VERSION`                   |
| Meta Cloud           | `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, optional `WHATSAPP_CLOUD_GRAPH_VERSION` |
| WhatsApp webhook     | `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, optional `KAPSO_WEBHOOK_SECRET`                                         |

Provider credentials are required only when selected by `NOTIFICATION_ROUTES`.
`WHATSAPP_WEBHOOK_VERIFY_TOKEN` is required by the notification runtime.

## Observability and development diagnostics

Server Sentry uses `VITE_SENTRY_DSN` and optional `SENTRY_TRACES_SAMPLE_RATE`.
Browser Sentry also reads `VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE` and
`VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE`.

Source-map uploads use `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`.

`VITE_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are
read at Vite build time, not only at container runtime. The container build must
receive them as Docker build args. `compose.app.yml` passes them through
`build.args`; `environment:` or `env_file:` alone does not reach the build
stage.

Logging uses `LOG_LEVEL` and `LOG_FORMAT`.

Server diagnostics use `DEBUG_DIAGNOSTICS`, `DEBUG_DIAGNOSTICS_FILTER`,
`DEBUG_DIAGNOSTICS_REQUESTS`, and `DEBUG_DIAGNOSTICS_REQUESTS_SLOW_MS`. Browser
diagnostics use `VITE_DEBUG_DIAGNOSTICS` and `VITE_DEBUG_DIAGNOSTICS_FILTER`.

See [`.env.example`](../../../.env.example) for local values and
[`ops/deployment/app.env.example`](../../../ops/deployment/app.env.example) for
the deployment template.

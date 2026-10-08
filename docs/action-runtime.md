# Action runtime

An action is a server function that the browser calls over RPC. Each action runs
through [`run.ts`](../apps/web/src/server/platform/action/run.ts), which is
exposed as `executeSessionServerFunction` and
`executeSessionServerFunctionResult` in
[`execute.ts`](../apps/web/src/server/platform/action/execute.ts). The runtime
runs four steps in a fixed order and returns at the first failure:

```text
parse -> authenticate -> authorize and step-up -> execute
```

| Step         | Failure is recorded in action telemetry | Source                                                               |
| ------------ | --------------------------------------- | -------------------------------------------------------------------- |
| Parse        | No                                      | `parse` in the action definition                                     |
| Authenticate | No                                      | [`access.ts`](../apps/web/src/server/platform/action/access.ts)      |
| Authorize    | Yes                                     | `access.kind` (`permission`, `role`, `auth`, `session`) and `stepUp` |
| Execute      | Yes                                     | `execute` in the action definition                                   |

Parsing and authentication fail before an actor exists, so those failures have
no actor to attribute a telemetry row to. A successful action also records a
row. The row is written without awaiting it, and a failed write never fails the
action ([`execute.ts`](../apps/web/src/server/platform/action/execute.ts)).

An action with `stepUp: "recent_strong_auth"` also needs a recent strong
authentication.

## Errors

Every failure leaves the runtime as a `WireError` through `projectFault` in
`run.ts`:

- `internal` and `external` domain errors are logged and sent to Sentry. The
  wire error then has kind `internal` and a generic message.
- A `rate_limit` error sets the `Retry-After` response header.
- [`domain-error.ts`](../apps/web/src/server/platform/action/domain-error.ts)
  maps the domain error kind to the wire kind and picks the message.

A `WireError` holds `kind`, `code`, `message`, and, for `rate_limit` only,
`retryAfterSeconds` ([`errors.ts`](../apps/web/src/contracts/errors.ts)). It
carries no internal detail. The server writes the user-facing message. Clients
render `message` and branch on `kind` or `code`.

`executeSessionServerFunctionResult` returns the `Result`.
`executeSessionServerFunction` throws an `ActionError` that carries the
`WireError`.

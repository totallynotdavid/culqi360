# Cookies

Choose the cookie API by where the cookie is read or written. `serializeCookie`
and `parseCookieHeader` come from `@solidjs/web`.

| Situation                                           | Use                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| Read or write a cookie during the current request   | `readCookie`, `writeCookie`, `expireCookie` from `~/server/platform/http/cookies` |
| Build or parse a cookie header on a manual response | `serializeCookie`, `parseCookieHeader`                                            |
| Read or write `document.cookie` in the browser      | `serializeCookie`, `parseCookieHeader`                                            |

## Request cookies

Server code reads and writes cookies through
[`cookies.ts`](../apps/web/src/server/platform/http/cookies.ts). It throws
outside a request scope: call it from middleware, a server function, or an API
handler. The session cookie in
[`session/cookies.ts`](../apps/web/src/server/auth/session/cookies.ts) uses it.

## Header strings and `document.cookie`

Use `serializeCookie` and `parseCookieHeader` directly when no request scope
exists or when the code handles header strings itself:

- [`ui-preference-cookie.ts`](../apps/web/src/browser/ui/ui-preference-cookie.ts)
  reads and writes `document.cookie` in the browser. During server rendering it
  reads the same cookie from the request `cookie` header and never writes.
- [`google-oauth-cookies.ts`](../apps/web/src/server/auth/google/google-oauth-cookies.ts)
  builds `Set-Cookie` header strings for the OAuth redirect and callback.

# Cookies

Choose the cookie API by where the cookie is read or written.

| Situation                                         | Use                                                             |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Read or write a cookie during the current request | `@solidjs/start/http`: `getCookie`, `setCookie`, `deleteCookie` |
| Build or parse a `Set-Cookie` header manually     | `cookie-es`: `serializeCookie`, `parseCookie`                   |
| Read or write `document.cookie` in the browser    | `cookie-es`: `serializeCookie`, `parseCookie`                   |

## `@solidjs/start/http`

Use it while handling the current request. It reads and writes cookies on the
response SolidStart is already building. Session cookies and other `httpOnly`
server-managed cookies use it, for example
[`session/cookies.ts`](../apps/web/src/server/auth/session/cookies.ts).

## `cookie-es`

Use it when there is no current SolidStart request, or when you work directly
with cookie header strings:

- Browser code that uses `document.cookie`, for example
  [`ui-preference-cookie.ts`](../apps/web/src/browser/ui/ui-preference-cookie.ts).
- A `Set-Cookie` header on a manually constructed `Response`, for example
  [`google-oauth-cookies.ts`](../apps/web/src/server/auth/google/google-oauth-cookies.ts).
- Cookie headers passed into standalone functions.

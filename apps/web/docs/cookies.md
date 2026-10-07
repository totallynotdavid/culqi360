# Cookies

Choose the API based on where the cookie is being read or written.

| Situation                                         | Use                                                             |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Read or write a cookie during the current request | `@solidjs/start/http`: `getCookie`, `setCookie`, `deleteCookie` |
| Build or parse a `Set-Cookie` header manually     | `cookie-es`: `serializeCookie`, `parseCookie`                   |
| Read or write `document.cookie` in the browser    | `cookie-es`: `serializeCookie`, `parseCookie`                   |

## `@solidjs/start/http`

Use this when handling the current request. It reads and writes cookies on the
response SolidStart is already building.

Typical uses include session cookies and other `httpOnly` server-managed
cookies.

See [`server/auth/session/cookies.ts`](../src/server/auth/session/cookies.ts).

## `cookie-es`

Use this when there is no current SolidStart request or when working directly
with cookie header strings.

Typical uses include:

- Browser code using `document.cookie`.
- Building a `Set-Cookie` header on a manually constructed `Response`.
- Parsing cookie headers passed into standalone functions.

See:

- [`browser/ui/ui-preference-cookie.ts`](../src/browser/ui/ui-preference-cookie.ts)
- [`server/auth/google/google-oauth-cookies.ts`](../src/server/auth/google/google-oauth-cookies.ts)

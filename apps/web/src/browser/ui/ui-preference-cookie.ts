import { parseCookieHeader, serializeCookie } from "@solidjs/web";
import { getRequestEvent, isServer } from "@solidjs/web";

export type UiPreferenceCookieCodec<T> = {
  decode: (value: string) => T | null;
  encode: (value: T) => string;
};

type UiPreferenceCookieOptions<T> = {
  name: string;
  maxAgeSeconds: number;
  codec: UiPreferenceCookieCodec<T>;
};

export const booleanUiPreferenceCookieCodec = {
  decode(value: string): boolean | null {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return null;
  },
  encode: String,
} satisfies UiPreferenceCookieCodec<boolean>;

function readServerCookie(name: string): string | null {
  const cookieHeader = getRequestEvent()?.request.headers.get("cookie");
  return cookieHeader ? (parseCookieHeader(cookieHeader)[name] ?? null) : null;
}

export function defineUiPreferenceCookie<T>(
  options: UiPreferenceCookieOptions<T>,
) {
  return {
    read(): T | null {
      const raw = isServer
        ? readServerCookie(options.name)
        : (parseCookieHeader(document.cookie)[options.name] ?? null);

      return raw === null ? null : options.codec.decode(raw);
    },

    write(value: T): void {
      if (isServer) {
        return;
      }

      document.cookie = serializeCookie(
        options.name,
        options.codec.encode(value),
        {
          path: "/",
          maxAge: options.maxAgeSeconds,
          sameSite: "lax",
        },
      );
    },
  };
}

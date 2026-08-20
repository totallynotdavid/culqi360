import type { APIEvent } from "filesystem-routing/api";

import { hasPermission } from "~/domain/auth/access/rbac";
import { UserId } from "~/domain/ids";
import { getApplication } from "~/server/composition/application";
import { getSession } from "~/server/platform/action/session";
import type { AvatarDomainErrorCode } from "~/server/users/avatar-service";
import { isErr } from "~/shared/result";

function mapAvatarErrorStatus(code: AvatarDomainErrorCode): number {
  switch (code) {
    case "avatar_not_found":
    case "user_not_found":
      return 404;
    case "repository_unavailable":
    case "storage_unavailable":
      return 503;
    case "invalid_file":
    case "too_large":
    case "unsupported_mime":
      return 400;
  }

  const exhaustiveCheck: never = code;
  return exhaustiveCheck satisfies never;
}

export async function GET(event: APIEvent): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!hasPermission(session.role, "team:read")) {
      return new Response("Forbidden", { status: 403 });
    }

    const parsedUserId = UserId.parse(event.params.userId);
    if (isErr(parsedUserId)) {
      return new Response("Not found", { status: 404 });
    }
    const userId = parsedUserId.value;

    const avatarResult = await getApplication().users.avatars.get(userId);
    if (!avatarResult.ok) {
      return new Response("Profile picture unavailable", {
        status: mapAvatarErrorStatus(avatarResult.error.code),
      });
    }

    const avatar = avatarResult.value;
    const etag = `"avatar-${userId}-v${avatar.version}"`;

    if (event.request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { etag, "cache-control": "private, no-cache" },
      });
    }

    const bodyBuffer = new ArrayBuffer(avatar.bytes.byteLength);
    new Uint8Array(bodyBuffer).set(avatar.bytes);

    return new Response(bodyBuffer, {
      status: 200,
      headers: {
        "content-type": avatar.mimeType,
        "cache-control": "private, no-cache",
        etag,
      },
    });
  } catch {
    return new Response("Unexpected error", { status: 500 });
  }
}

import type { UserId } from "~/domain/ids";
import type {
  AvatarDomainErrorCode,
  AvatarService,
} from "~/server/users/avatar-service";

type AvatarErrorResponse = {
  status: number;
  body: string;
};

function mapAvatarErrorResponse(
  code: AvatarDomainErrorCode,
): AvatarErrorResponse {
  switch (code) {
    case "avatar_not_found":
      return { status: 404, body: "Profile picture not found" };
    case "user_not_found":
      return { status: 404, body: "User not found" };
    case "repository_unavailable":
    case "storage_unavailable":
      return { status: 503, body: "Profile picture service unavailable" };
    case "invalid_file":
    case "too_large":
    case "unsupported_mime":
      return { status: 400, body: "Invalid profile picture request" };
  }

  const exhaustiveCode: never = code;
  return exhaustiveCode satisfies never;
}

/**
 * Serves one user's avatar bytes as a conditional response.
 *
 * Who is allowed to ask is the route's business and differs per route (your own
 * avatar versus a teammate's), so this takes an already-authorized user id and
 * owns only what both routes agree on: the version ETag, the 304, and the
 * error-code mapping.
 */
export async function respondWithAvatar(
  request: Request,
  userId: UserId,
  avatars: Pick<AvatarService, "get">,
): Promise<Response> {
  const avatarResult = await avatars.get(userId);

  if (!avatarResult.ok) {
    const errorResponse = mapAvatarErrorResponse(avatarResult.error.code);
    return new Response(errorResponse.body, { status: errorResponse.status });
  }

  const avatar = avatarResult.value;
  const etag = `"avatar-${userId}-v${avatar.version}"`;

  if (request.headers.get("if-none-match") === etag) {
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
}

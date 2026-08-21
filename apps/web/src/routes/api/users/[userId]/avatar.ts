import type { APIEvent } from "filesystem-routing/api";

import { hasPermission } from "~/domain/auth/access/rbac";
import { UserId } from "~/domain/ids";
import { getApplication } from "~/server/composition/application";
import { getSession } from "~/server/platform/action/session";
import { respondWithAvatar } from "~/server/users/avatar-http";
import { isErr } from "~/shared/result";

export async function GET(event: APIEvent): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!hasPermission(session.role, "team:read")) {
      return new Response("Forbidden", { status: 403 });
    }

    const parsedUserId = UserId.parse(event.params?.userId);
    if (isErr(parsedUserId)) {
      return new Response("Not found", { status: 404 });
    }

    return await respondWithAvatar(
      event.request,
      parsedUserId.value,
      getApplication().users.avatars,
    );
  } catch {
    return new Response("Unexpected error", { status: 500 });
  }
}

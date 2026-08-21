import type { APIEvent } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import { getSession } from "~/server/platform/action/session";
import { respondWithAvatar } from "~/server/users/avatar-http";

export async function GET(event: Pick<APIEvent, "request">): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    return await respondWithAvatar(
      event.request,
      session.userId,
      getApplication().users.avatars,
    );
  } catch {
    return new Response("Unexpected error", { status: 500 });
  }
}

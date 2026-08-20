import type { APIEvent } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import { getSession } from "~/server/platform/action/session";
import { respondToAvatarRequest } from "~/server/users/avatar-http";

export async function GET(event: Pick<APIEvent, "request">): Promise<Response> {
  try {
    return await respondToAvatarRequest(
      event.request,
      await getSession(),
      getApplication().users.avatars,
    );
  } catch {
    return new Response("Unexpected error", { status: 500 });
  }
}

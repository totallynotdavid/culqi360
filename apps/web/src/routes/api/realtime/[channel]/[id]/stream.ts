import type { APIHandler } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import { getRequestContext } from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

export const GET: APIHandler = async (event) => {
  const stream = await getApplication().realtime.openStream(
    getRequestContext().principal,
    {
      channel: event.params!.channel!,
      id: event.params!.id!,
      cursor: event.request.headers.get("last-event-id"),
    },
  );

  if (isErr(stream)) {
    return new Response(null, {
      status:
        stream.error === "unauthenticated"
          ? 401
          : stream.error === "not_found"
            ? 404
            : 503,
    });
  }

  return stream.value;
};

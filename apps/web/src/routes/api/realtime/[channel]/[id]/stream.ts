import type { APIHandler } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import { getRequestContext } from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

export const GET: APIHandler = async (event) => {
  const channel = event.params?.channel;
  const id = event.params?.id;

  // The route only matches with both segments filled, but the matcher types
  // params as optional, so reject rather than assert them into existence.
  if (!channel || !id) {
    return new Response("Missing channel or id", { status: 400 });
  }

  const stream = await getApplication().realtime.openStream(
    getRequestContext().principal,
    {
      channel,
      id,
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

import type { APIEvent } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import { buildFileDownloadHeaders } from "~/server/files/headers";
import { toWire } from "~/server/platform/action/domain-error";
import { getRequestOperation } from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

export async function GET(
  event: Pick<APIEvent, "params" | "request">,
): Promise<Response> {
  try {
    const token = event.params?.token;
    if (!token || typeof token !== "string" || token.length < 16) {
      return new Response("Invalid token", { status: 400 });
    }

    const now = getRequestOperation();

    const result = await getApplication().files.download(token, now);

    if (isErr(result)) {
      const kind = result.error.kind;
      const status =
        kind === "not_found" ? 404 : kind === "conflict" ? 410 : 500;
      return new Response(toWire(result.error).message, { status });
    }

    const { fileAsset, body } = result.value;
    const requestUrl = new URL(event.request.url);
    const isInline = requestUrl.searchParams.get("inline") === "1";
    const headers = buildFileDownloadHeaders(
      fileAsset.detectedMime,
      fileAsset.safeDisplayFilename,
      { disposition: isInline ? "inline" : "attachment" },
    );

    return new Response(body, { status: 200, headers });
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Unexpected error",
      { status: 500 },
    );
  }
}

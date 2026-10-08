import { getRequestEvent, renderToStream } from "@solidjs/web";
import manifest from "virtual:solid-manifest";

import Root from "./Root";

export function render() {
  const nonce = getRequestEvent()?.locals.nonce;

  return renderToStream(() => <Root />, { manifest, nonce });
}

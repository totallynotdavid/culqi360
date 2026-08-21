/**
 * The server bundle emitted by `vite build` into `dist/server/`. It does not
 * exist in the source tree, so its contract is declared here: a web `Request`
 * in, a promised web `Response` out.
 */
declare module "*/dist/server/server.js" {
  export function handleRequest(
    request: Request,
    options?: {
      /** Applied to the client entry script the handler injects into <head>. */
      nonce?: string;
      /** Extra fields spread onto the request event at creation. */
      event?: Record<string, unknown>;
    },
  ): Promise<Response>;
}

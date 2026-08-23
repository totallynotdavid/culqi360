import type { RequestContext } from "~/server/platform/http/request-context-storage";

declare module "@solidjs/web" {
  interface RequestEventLocals {
    requestContext: RequestContext;
    /**
     * Seeded by the serving layer, which also hands it to `handleRequest` for
     * the injected client entry script. Absent in development, where the Vite
     * dev server owns that injection.
     */
    nonce?: string;
  }
}

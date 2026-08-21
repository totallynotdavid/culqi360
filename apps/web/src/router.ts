import { createRouter } from "@solidjs/router";
import { fileRoutes } from "@solidjs/router/fs";
import { pageRoutes } from "virtual:file-routes";

// One instance shared by the client, the SSR render, and the single-flight
// data collector in server-config.ts. Route topology comes from src/routes,
// scanned by the fileRoutes plugin in vite.config.ts.
export const Router = createRouter({ routes: fileRoutes(pageRoutes) });

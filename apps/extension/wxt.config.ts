import path from "node:path";

import solid from "@solidjs/vite-plugin";
import { defineConfig } from "wxt";

function toOriginMatchPattern(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    return `${url.origin}/*`;
  } catch {
    return null;
  }
}

const webOriginMatch = toOriginMatchPattern(process.env.CRM_WEB_ORIGIN);
const extensionHostPermissions = [
  webOriginMatch,
  "http://127.0.0.1/*",
  "http://localhost/*",
].filter((value): value is string => typeof value === "string" && value !== "");

/**
 * The test build swaps `#tab-capture` because headless Chromium cannot grant
 * the active-tab invocation required by `getMediaStreamId`. WXT merges its
 * aliases over `vite.resolve.alias`, so this must be a top-level alias.
 */
const tabCaptureModule =
  process.env.CRM_FAKE_TAB_CAPTURE === "1"
    ? "tab-capture.fake.ts"
    : "tab-capture.ts";

export default defineConfig({
  alias: {
    "#tab-capture": path.resolve(__dirname, "src/services", tabCaptureModule),
  },
  vite: () => ({
    plugins: [solid()],
    resolve: { dedupe: ["solid-js", "@solidjs/web"] },
  }),
  manifest: {
    name: "CRM call companion",
    description:
      "Persistent VoIP session state, recording queue, and offline-first sync.",
    permissions: [
      "storage",
      "alarms",
      "offscreen",
      "tabCapture",
      "activeTab",
      "sidePanel",
      "unlimitedStorage",
    ],
    commands: {
      "start-recording": {
        suggested_key: { default: "Alt+Shift+K" },
        description: "Record the call tab",
      },
    },
    host_permissions: extensionHostPermissions,
    externally_connectable: {
      matches: extensionHostPermissions,
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
  },
});

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

export default defineConfig({
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
    ],
    host_permissions: extensionHostPermissions,
    externally_connectable: {
      matches: extensionHostPermissions,
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
  },
});

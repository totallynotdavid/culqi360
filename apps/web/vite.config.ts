import { responsiveImagesPlugin } from "@crm/images/vite";
import mdx from "@mdx-js/rollup";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import solid from "@solidjs/vite-plugin";
import { fileRoutes } from "filesystem-routing/vite";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { bundleAnalyzerPlugin } from "rolldown/experimental";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

import { appAlias } from "./paths.ts";
import {
  createRequestTracePlugin,
  resolveRequestTraceConfig,
} from "./tracer.ts";

const requestTraceConfig = resolveRequestTraceConfig(process.env);

// Route files carry MDX alongside TSX: the updates feed and the legal and
// docs pages are authored as content, not components.
const ROUTE_EXTENSIONS = ["js", "jsx", "ts", "tsx", "md", "mdx"];

function shouldUploadSourceMaps(command: string): boolean {
  return (
    command === "build" &&
    Boolean(
      process.env.SENTRY_AUTH_TOKEN &&
      process.env.SENTRY_ORG &&
      process.env.SENTRY_PROJECT,
    )
  );
}

export default defineConfig(({ command }) => {
  const uploadSourceMaps = shouldUploadSourceMaps(command);

  return {
    cacheDir: process.env.VITE_CACHE_DIR,

    build: {
      sourcemap: uploadSourceMaps,
    },

    resolve: {
      // Start mode does not define SolidStart's `~` alias; the app owns it.
      alias: { ...appAlias },
      dedupe: ["solid-js", "@solidjs/web"],
    },

    ssr: {
      // Native addon: it cannot be bundled into the server output.
      external: ["@node-rs/argon2"],
    },

    server: {
      // The preview CLI pins the dev server to a fixed origin so the links the
      // app generates match where it is served. Plain Vite does not read
      // PORT/HOST the way the removed Nitro dev server did, and silently
      // walking to the next free port is what makes a mismatch hard to see, so
      // a requested port is strict.
      port: process.env.PORT ? Number(process.env.PORT) : undefined,
      strictPort: Boolean(process.env.PORT),
      host: process.env.HOST,

      // Initialize the CSS-module cache for cold SSR renders.
      // See vitejs/vite#19606.
      perEnvironmentStartEndDuringDev: true,

      watch: {
        ignored: ["**/.local-storage/**"],
      },
    },

    plugins: [
      ...createRequestTracePlugin(requestTraceConfig),

      {
        enforce: "pre",
        ...mdx({
          include: /\.mdx?$/,
          jsx: true,
          jsxImportSource: "@solidjs/web",
          remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
        }),
      },

      solid({
        start: {
          middleware: "./src/middleware.ts",
          // Vite resolves the optional peer dep to a stub rather than to
          // nothing, so the plugin's probe believes @solidjs/start-devtools is
          // installed and injects `import { DevToolbar }` into the client
          // entry. The stub exports no such thing, the entry module fails to
          // parse, and the app never hydrates: server markup with no client
          // behind it, and no error anywhere but the browser console.
          devtools: false,
        },
        ssr: true,
        serverFunctions: {
          filter: {
            include: ["src/rpc/**/*.ts"],
          },
          configure: "./src/server-config.ts",
        },
        // `.jsx`/`.tsx` cover the `?pick=` route ids emitted by fileRoutes;
        // the MDX entries are content routes the transform must also accept.
        extensions: [".jsx", ".tsx", ".md", ".mdx"],
      }),

      fileRoutes({
        httpMethods: true,
        extensions: ROUTE_EXTENSIONS,
        types: true,
      }),

      visualizer(),
      bundleAnalyzerPlugin({ format: "md" }),
      responsiveImagesPlugin(),

      ...(uploadSourceMaps
        ? [
            sentryVitePlugin({
              authToken: process.env.SENTRY_AUTH_TOKEN,
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,

              // Debug IDs map stack traces without creating a release.
              release: { create: false },

              sourcemaps: {
                filesToDeleteAfterUpload: ["**/*.map"],
              },
              telemetry: false,
            }),
          ]
        : []),
    ],

    esbuild: {
      target: "es2022",
    },
  };
});

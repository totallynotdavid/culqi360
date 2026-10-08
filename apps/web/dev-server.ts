// The default origin in `.env.example`, the extension, and the production
// image all use this port.
export const DEFAULT_DEV_PORT = 3000;

/**
 * Plain Vite does not read PORT/HOST the way the removed Nitro dev server did.
 * The port is always strict: walking to the next free port would serve the app
 * where none of the configured origins point, and nothing reports it.
 */
export function resolveDevServer(env: NodeJS.ProcessEnv) {
  return {
    port: env.PORT ? Number(env.PORT) : DEFAULT_DEV_PORT,
    strictPort: true,
    host: env.HOST,
  };
}

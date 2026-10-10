import { WebGLRenderer, type WebGLRendererParameters } from "three";

type SiteWebGlRendererParameters = WebGLRendererParameters & {
  onContextLost?: (event: Event) => void;
};

export const SITE_WEBGL_CONTEXT_LOST_EVENT = "sitewebglcontextlost";

export function createSiteWebGlRenderer(
  parameters?: SiteWebGlRendererParameters,
): WebGLRenderer {
  const { onContextLost, ...rendererParameters } = parameters ?? {};

  const renderer = new WebGLRenderer(rendererParameters);
  const canvas = renderer.domElement;

  let disposed = false;
  const safeDispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    canvas.removeEventListener("webglcontextlost", handleContextLost);
    try {
      originalDispose();
    } catch {
      // Disposing a renderer whose context was already torn down can
      // throw "delete: object does not belong to this context". The renderer is
      // already torn down, so the disposal failure must not reach the consumer.
    }
  };

  const handleContextLost = (event: Event) => {
    event.preventDefault();

    try {
      onContextLost?.(event);
    } catch (callbackError) {
      if (import.meta.env.DEV) {
        console.error("onContextLost callback threw:", callbackError);
      }
    }

    canvas.dispatchEvent(
      new CustomEvent(SITE_WEBGL_CONTEXT_LOST_EVENT, { bubbles: true }),
    );

    safeDispose();
  };

  canvas.addEventListener("webglcontextlost", handleContextLost, false);

  const originalDispose = renderer.dispose.bind(renderer);
  renderer.dispose = safeDispose;

  return renderer;
}

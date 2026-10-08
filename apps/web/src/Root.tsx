import { type JSX } from "@solidjs/web";
import { DefaultErrorBoundary } from "virtual:solid-ssr-error-boundary.tsx";

import App from "./App";
import Document from "./Document";

function PassThrough(props: { children?: JSX.Element }) {
  return props.children;
}

// The plugin's generated entries wrap the tree in its error boundary only in a
// build. In dev the boundary would turn a render error into a bare 500 span
// and hide it from Vite's error overlay.
const ErrorBoundary = import.meta.env.PROD ? DefaultErrorBoundary : PassThrough;

// The tree both entries render. Server and browser must build the same tree,
// so it lives in one place.
export default function Root() {
  return (
    <ErrorBoundary>
      <Document>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </Document>
    </ErrorBoundary>
  );
}

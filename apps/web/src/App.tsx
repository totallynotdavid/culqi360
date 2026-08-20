import { Title } from "@solidjs/meta";
import { Loading } from "solid-js";

import { PLATFORM_NAME } from "~/shared/branding";

import "./browser/bootstrap";

import { AppErrorBoundary } from "./components/feedback/error/boundary";
import { SnackBarProvider } from "./components/feedback/snack-bar-manager/snack-bar-provider";
import { ThemeProvider } from "./components/ui/theme/theme-context";
import { Router } from "./router";

import "./app.css";

// The application tree. The document shell is Document.tsx; the plugin's
// generated entries render <Document><App /></Document> and hydrate the same
// tree in the browser. Solid 2's head registry is ambient, so there is no
// MetaProvider to mount.
export default function App() {
  return (
    <ThemeProvider>
      <SnackBarProvider>
        <AppErrorBoundary>
          <Router>
            {(props) => (
              <>
                <Title>{PLATFORM_NAME}</Title>
                <Loading>{props.children}</Loading>
              </>
            )}
          </Router>
        </AppErrorBoundary>
      </SnackBarProvider>
    </ThemeProvider>
  );
}

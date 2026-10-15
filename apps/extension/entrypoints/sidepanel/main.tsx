import { render } from "@solidjs/web";

import { Dashboard } from "@/src/ui/dashboard";

render(
  () => <Dashboard surface="sidepanel" />,
  document.getElementById("root")!,
);

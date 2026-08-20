import { useNavigate } from "@solidjs/router";

// Router 2 removed <Navigate>; a redirect-only route navigates at setup.
export default function SettingsIndex() {
  useNavigate()("/settings/profile", { replace: true });
  return null;
}

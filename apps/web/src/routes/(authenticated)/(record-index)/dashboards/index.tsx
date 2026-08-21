import { useNavigate } from "@solidjs/router";

// Router 2 removed <Navigate>; a redirect-only route navigates at setup.
export default function DashboardsIndexRoute() {
  useNavigate()("/dashboards/merchant-gpv", { replace: true });
  return null;
}

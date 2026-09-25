import Activity from "~/components/icons/activity";
import Building2 from "~/components/icons/building-2";
import CalendarDays from "~/components/icons/calendar-days";
import House from "~/components/icons/house";
import type { IconComponent } from "~/components/icons/icon-base";
import Info from "~/components/icons/info";
import LayoutDashboard from "~/components/icons/layout-dashboard";
import Moneybag from "~/components/icons/moneybag";
import Package from "~/components/icons/package";
import Search from "~/components/icons/search";
import Settings from "~/components/icons/settings";
import User from "~/components/icons/user";
import UserRound from "~/components/icons/user-round";
import Users from "~/components/icons/users";
import type { RouteIcon } from "~/domain/navigation/config";

export const ICON_BY_ROUTE: Record<RouteIcon, IconComponent> = {
  search: Search,
  settings: Settings,
  team: Users,
  inventory: Package,
  leads: User,
  "rate-simulator": Moneybag,
  home: House,
  audit: Info,
  capacity: Building2,
  profile: UserRound,
  schedule: CalendarDays,
  monitoring: Activity,
  dashboards: LayoutDashboard,
};

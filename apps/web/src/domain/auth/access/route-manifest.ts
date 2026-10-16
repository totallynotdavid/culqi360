import type { Permission, Role } from "./rbac";

export type AppPath =
  | "/settings/security"
  | "/settings/login-protection"
  | "/settings/security-policies"
  | "/settings/capacity-policies"
  | "/settings/quotation-policies"
  | "/settings/commission-scheme"
  | "/settings/event-logs"
  | "/settings/data-sources"
  | "/monitoring"
  | "/settings/members"
  | "/team"
  | "/team/requests"
  | "/inventory"
  | "/records"
  | "/inquiries"
  | "/fulfillment"
  | "/rate-simulator"
  | "/home"
  | "/dashboards"
  | "/dashboards/merchant-gpv"
  | "/schedule"
  | "/settings/profile"
  | "/settings/appearance"
  | "/settings/notifications"
  | "/me/capacity"
  | "/me/assignments";

export interface RouteConfig {
  permission?: Permission;
  roles?: readonly Role[];
  landingPriority?: number;
}

export interface DynamicRouteConfig {
  pattern: RegExp;
  permission?: Permission;
  roles?: readonly Role[];
}

export const ROUTE_MANIFEST: Record<AppPath, RouteConfig> = {
  "/settings/security": {},
  "/settings/login-protection": { permission: "admin:manage" },
  "/settings/security-policies": { permission: "admin:manage" },
  "/settings/capacity-policies": { permission: "capacity:policy:manage" },
  "/settings/quotation-policies": { permission: "quotation:policy:manage" },
  "/settings/commission-scheme": { permission: "commission:manage" },
  "/settings/event-logs": { permission: "audit:read" },
  "/settings/data-sources": { permission: "data-source:import" },
  "/monitoring": { permission: "admin:read" },
  "/settings/members": { permission: "team:read" },
  "/team": { permission: "team:read", landingPriority: 6 },
  "/team/requests": { permission: "capacity:approve", landingPriority: 7 },
  "/inventory": { permission: "inventory:read", landingPriority: 5 },
  "/records": {},
  "/inquiries": { permission: "lead:register" },
  "/fulfillment": { permission: "fulfillment:manage" },
  "/rate-simulator": { permission: "lead:rate:simulate", landingPriority: 4 },
  "/home": {
    permission: "lead:work",
    roles: ["executive", "sales_manager"],
    landingPriority: 1,
  },
  "/dashboards": { permission: "dashboards:read" },
  "/dashboards/merchant-gpv": { permission: "dashboards:read" },
  "/schedule": {},
  "/settings/profile": {},
  "/settings/appearance": {},
  "/settings/notifications": {},
  "/me/capacity": { permission: "capacity:read:self" },
  "/me/assignments": { permission: "lead:work" },
};

export const DYNAMIC_ROUTES: DynamicRouteConfig[] = [
  { pattern: /^\/records\/[^/]+$/ },
  // Resolving quality rows requires dashboards:manage; the summary requires dashboards:read.
  {
    pattern: /^\/dashboards\/merchant-gpv\/(?:imports|quality)\/[^/]+$/,
    permission: "dashboards:manage",
  },
  { pattern: /^\/dashboards\/[^/]+$/, permission: "dashboards:read" },
  {
    pattern: /^\/settings\/members\/[^/]+$/,
    permission: "team:read",
  },
];

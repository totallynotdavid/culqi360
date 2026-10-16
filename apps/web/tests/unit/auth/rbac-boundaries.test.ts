import { describe, expect, it } from "vitest";

import {
  getPermissions,
  hasPermission,
  type Permission,
} from "~/domain/auth/access/rbac";

const ALL_PERMISSIONS: Permission[] = [
  "lead:rate:simulate",
  "lead:work",
  "lead:workflow",
  "sales:create",
  "sales:submit",
  "sales:review",
  "sales:approve",
  "search:use",
  "capacity:read:self",
  "capacity:request:self",
  "capacity:read:team",
  "capacity:manage",
  "capacity:approve",
  "capacity:policy:manage",
  "capacity:audit:read",
  "team:read",
  "team:manage",
  "inventory:read",
  "inventory:manage",
  "hr:read",
  "team:invite",
  "admin:read",
  "admin:manage",
  "audit:read",
  "lead:register",
  "lead:view:all",
  "lead:review",
  "lead:reassign",
  "quotation:create",
  "quotation:revise",
  "quotation:view:all",
  "integration:manage",
];

describe("rbac boundaries", () => {
  it("returns empty permissions for unknown role", () => {
    expect(getPermissions("unknown_role")).toEqual([]);
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission("unknown_role", permission)).toBe(false);
    }
  });

  it("keeps executive and supervisor permissions on separate boundaries", () => {
    const executivePerms = new Set(getPermissions("executive"));
    const supervisorPerms = new Set(getPermissions("supervisor"));

    expect(supervisorPerms.has("sales:approve")).toBe(true);
    expect(executivePerms.has("sales:approve")).toBe(false);
    expect(executivePerms.has("lead:rate:simulate")).toBe(true);
    expect(supervisorPerms.has("team:manage")).toBe(true);
    expect(supervisorPerms.has("lead:view:all")).toBe(true);
    expect(executivePerms.has("team:manage")).toBe(false);
    expect(executivePerms.has("lead:workflow")).toBe(true);
    expect(supervisorPerms.has("lead:workflow")).toBe(false);
    expect(executivePerms.has("lead:register")).toBe(true);
    expect(supervisorPerms.has("lead:register")).toBe(false);
    expect(supervisorPerms.has("lead:reassign")).toBe(false);
  });

  it("keeps workflow permissions scoped to the intended roles", () => {
    expect(hasPermission("executive", "lead:workflow")).toBe(true);
    expect(hasPermission("executive", "lead:register")).toBe(true);
    expect(hasPermission("executive", "lead:review")).toBe(false);
    expect(hasPermission("executive", "quotation:create")).toBe(false);
    expect(hasPermission("executive", "quotation:revise")).toBe(false);
    expect(hasPermission("executive", "quotation:view:all")).toBe(false);

    expect(hasPermission("back_office", "lead:workflow")).toBe(false);
    expect(hasPermission("back_office", "lead:view:all")).toBe(true);
    expect(hasPermission("back_office", "lead:review")).toBe(true);
    expect(hasPermission("back_office", "quotation:create")).toBe(true);
    expect(hasPermission("back_office", "quotation:revise")).toBe(true);
    expect(hasPermission("back_office", "quotation:view:all")).toBe(true);
    expect(hasPermission("back_office", "integration:manage")).toBe(true);
    expect(hasPermission("back_office", "lead:register")).toBe(false);

    expect(hasPermission("admin", "lead:workflow")).toBe(false);
    expect(hasPermission("admin", "lead:register")).toBe(false);
    expect(hasPermission("admin", "lead:reassign")).toBe(true);
    expect(hasPermission("admin", "quotation:create")).toBe(true);
    expect(hasPermission("admin", "quotation:revise")).toBe(true);
    expect(hasPermission("admin", "quotation:view:all")).toBe(true);
    expect(hasPermission("admin", "integration:manage")).toBe(true);

    expect(hasPermission("supervisor", "lead:reassign")).toBe(false);
    expect(hasPermission("supervisor", "lead:view:all")).toBe(true);
    expect(hasPermission("sales_manager", "lead:reassign")).toBe(false);
    expect(hasPermission("sales_manager", "lead:view:all")).toBe(true);
    expect(hasPermission("sales_manager", "team:invite")).toBe(true);

    expect(hasPermission("superuser", "lead:workflow")).toBe(false);
    expect(hasPermission("superuser", "lead:register")).toBe(false);
    expect(hasPermission("superuser", "lead:review")).toBe(true);
    expect(hasPermission("superuser", "quotation:create")).toBe(true);
    expect(hasPermission("superuser", "quotation:revise")).toBe(true);
    expect(hasPermission("superuser", "quotation:view:all")).toBe(true);
    expect(hasPermission("superuser", "integration:manage")).toBe(true);

    expect(hasPermission("sales_manager", "data-source:import")).toBe(true);
    expect(hasPermission("admin", "data-source:import")).toBe(true);
    expect(hasPermission("superuser", "data-source:import")).toBe(true);
    expect(hasPermission("executive", "data-source:import")).toBe(false);
    expect(hasPermission("supervisor", "data-source:import")).toBe(false);
    expect(hasPermission("back_office", "data-source:import")).toBe(false);
    expect(hasPermission("logistics", "data-source:import")).toBe(false);
    expect(hasPermission("hr", "data-source:import")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  canAccessPath,
  getDefaultAppPath,
  getRoutePermission,
} from "~/domain/auth/access/route-policy";
import { getHeaderRoute } from "~/domain/navigation/policy";

describe("route permissions", () => {
  it("resolves static and dynamic route permissions", () => {
    expect(getRoutePermission("/team")).toBe("team:read");
    expect(getRoutePermission("/records")).toBeNull();
    expect(getRoutePermission("/rate-simulator")).toBe("lead:rate:simulate");
    expect(getRoutePermission("/records/new")).toBeNull();
    expect(getRoutePermission("/records/123")).toBeNull();
    expect(getRoutePermission("/home")).toBe("lead:work");
    expect(getRoutePermission("/settings/profile")).toBeNull();
  });

  it("enforces role access checks for restricted paths", () => {
    expect(canAccessPath("executive", "/settings/event-logs")).toBe(false);
    expect(canAccessPath("supervisor", "/settings/event-logs")).toBe(true);
    expect(canAccessPath("executive", "/settings/capacity-policies")).toBe(
      false,
    );
    expect(canAccessPath("executive", "/records")).toBe(true);
    expect(canAccessPath("executive", "/rate-simulator")).toBe(true);
    expect(canAccessPath("admin", "/records")).toBe(true);
    expect(canAccessPath("admin", "/rate-simulator")).toBe(true);
    expect(canAccessPath("logistics", "/records")).toBe(true);
    expect(canAccessPath("logistics", "/rate-simulator")).toBe(false);
    expect(canAccessPath("executive", "/team")).toBe(false);
    expect(canAccessPath("hr", "/team")).toBe(true);
    expect(canAccessPath("admin", "/settings/catalog")).toBe(true);
  });

  it("returns a role-safe default path", () => {
    expect(getDefaultAppPath("executive")).toBe("/home");
    expect(getDefaultAppPath("logistics")).toBe("/inventory");
    expect(getDefaultAppPath("hr")).toBe("/team");
    expect(getDefaultAppPath("back_office")).toBe("/records");
    expect(getDefaultAppPath("supervisor")).toBe("/records");
    expect(getDefaultAppPath("admin")).toBe("/records");
    expect(getDefaultAppPath("superuser")).toBe("/records");
  });
});

describe("page headers", () => {
  it("resolves header metadata for current dynamic routes", () => {
    expect(getHeaderRoute("/rate-simulator").label).toBe("Simulador de tasas");
  });

  it("uses fallback when no header rule exists", () => {
    expect(getHeaderRoute("/unknown-route").label).toBe("Espacio de trabajo");
    expect(getHeaderRoute("/home").label).toBe("Inicio");
  });
});

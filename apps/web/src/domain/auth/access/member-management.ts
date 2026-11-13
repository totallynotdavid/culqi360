import { canAssignRole, hasPermission, type Role } from "./rbac";

// Identity checks need the actor and target ids; they live in the use-cases.

export function canManageMember(actorRole: Role, targetRole: Role): boolean {
  return (
    hasPermission(actorRole, "team:manage") &&
    canAssignRole(actorRole, targetRole)
  );
}

export function canDeleteMember(actorRole: Role, targetRole: Role): boolean {
  return canManageMember(actorRole, targetRole) && targetRole !== "superuser";
}

export function canImpersonateMember(
  actorRole: Role,
  targetRole: Role,
): boolean {
  return hasPermission(actorRole, "admin:manage") && targetRole !== "superuser";
}

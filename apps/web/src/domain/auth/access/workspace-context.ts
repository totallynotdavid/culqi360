import type { BranchId, TeamId, UserId } from "~/domain/ids";

import type { Role } from "./rbac";
import {
  getWorkspaceScopeForRole,
  requiresStrictTeamHierarchy,
  type WorkspaceScopeType,
} from "./workspace-scope";

interface TeamRecord {
  id: TeamId;
  name: string;
  branch_id: BranchId;
}

interface ManagedTeamRecord {
  id: TeamId;
  name: string;
  branch_id: BranchId;
}

export interface WorkspaceIdentity {
  scopeType: WorkspaceScopeType;
  team: { id: TeamId; name: string } | null;
  supervisor: { id: UserId; names: string } | null;
  branch: { id: BranchId; name: string } | null;
}

interface ResolveWorkspaceContextInput {
  role: Role;
  userId: UserId;
  branchId: BranchId;
  branchName: string | null;
  userTeamId: TeamId | null;
  assignedTeam: TeamRecord | null;
  managedTeam: ManagedTeamRecord | null;
  branchSupervisors: Array<{ id: string; user_id: UserId; names: string }>;
}

function createTeam(team: { id: TeamId; name: string } | null) {
  if (!team) {
    return null;
  }
  return { id: team.id, name: team.name };
}

export function resolveWorkspaceContext(
  input: ResolveWorkspaceContextInput,
): WorkspaceIdentity {
  const scopeType = getWorkspaceScopeForRole(input.role);
  const branch = input.branchName
    ? { id: input.branchId, name: input.branchName }
    : null;

  if (requiresStrictTeamHierarchy(input.role)) {
    if (!input.userTeamId || !input.assignedTeam) {
      throw new Error("User hierarchy misconfigured: executive has no team");
    }
    if (input.assignedTeam.branch_id !== input.branchId) {
      throw new Error("User hierarchy misconfigured: team branch mismatch");
    }

    const [firstSupervisor] = input.branchSupervisors;
    const supervisor = firstSupervisor
      ? { id: firstSupervisor.user_id, names: firstSupervisor.names }
      : null;

    return {
      scopeType,
      team: createTeam(input.assignedTeam),
      supervisor,
      branch,
    };
  }

  return {
    scopeType,
    team: null,
    supervisor: null,
    branch,
  };
}

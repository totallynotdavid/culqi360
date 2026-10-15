import type { ContactAssignmentsRepo } from "~/server/contact-assignments/infrastructure/assignment-repo";
import type { OrganizationRepository } from "~/server/organization/organization-repo";
import type { AppUow } from "~/server/platform/database/uow";
import type { BlobStore } from "~/server/platform/files/blob-store";
import type { SessionRepository } from "~/server/sessions/repos-sessions";
import type { UsersRepo } from "~/server/users/repos-users";

import type { ExtensionRecordingsRepo } from "../recordings-repo";
import type { ExtensionRuntimeRepo } from "../repos";

export type ExtensionRepos = {
  contactAssignments: ContactAssignmentsRepo;
  extensionRecordings: ExtensionRecordingsRepo;
  extensionRuntime: ExtensionRuntimeRepo;
  organization: OrganizationRepository;
  sessions: SessionRepository;
  users: UsersRepo;
};

export interface ExtensionServiceDeps {
  uow: AppUow<ExtensionRepos>;
  storage: BlobStore;
}

export async function hasActiveAuthSession(
  repos: ExtensionRepos,
  authSessionId: string,
  activeAsOf: Date,
): Promise<boolean> {
  const authSession = await repos.sessions.findById(authSessionId);
  if (!authSession || authSession.expires_at <= activeAsOf) {
    return false;
  }

  const user = await repos.users.findById(authSession.user_id);
  return (
    user != null &&
    user.is_active &&
    (user.expires_at === null || user.expires_at > activeAsOf)
  );
}

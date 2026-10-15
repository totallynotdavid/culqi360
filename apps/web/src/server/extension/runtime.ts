import {
  createContactAssignmentsRepo,
  type ContactAssignmentsRepo,
} from "~/server/contact-assignments/infrastructure/assignment-repo";
import {
  createExtensionRecordingsRepo,
  type ExtensionRecordingsRepo,
} from "~/server/extension/recordings-repo";
import {
  createExtensionRuntimeRepo,
  type ExtensionRuntimeRepo,
} from "~/server/extension/repos";
import { createExtensionService } from "~/server/extension/service";
import {
  createOrganizationRepo,
  type OrganizationRepository,
} from "~/server/organization/organization-repo";
import { createExecutorUow } from "~/server/platform/database/uow";
import type { BlobStore } from "~/server/platform/files/blob-store";
import type { ServerInfrastructure } from "~/server/platform/infrastructure";
import {
  createSessionRepository,
  type SessionRepository,
} from "~/server/sessions/repos-sessions";
import { createUsersRepo, type UsersRepo } from "~/server/users/repos-users";

type ExtensionRuntimeRepos = {
  contactAssignments: ContactAssignmentsRepo;
  extensionRecordings: ExtensionRecordingsRepo;
  extensionRuntime: ExtensionRuntimeRepo;
  organization: OrganizationRepository;
  sessions: SessionRepository;
  users: UsersRepo;
};

function buildRepos(db: ServerInfrastructure["db"]): ExtensionRuntimeRepos {
  return {
    contactAssignments: createContactAssignmentsRepo(db),
    extensionRecordings: createExtensionRecordingsRepo(db),
    extensionRuntime: createExtensionRuntimeRepo(db),
    organization: createOrganizationRepo(db),
    sessions: createSessionRepository(db),
    users: createUsersRepo(db),
  };
}

export function createExtensionRuntime(
  serverInfrastructure: ServerInfrastructure,
  storage: BlobStore,
) {
  return createExtensionService(buildRepos(serverInfrastructure.db), {
    uow: createExecutorUow(serverInfrastructure.db, buildRepos),
    storage,
  });
}

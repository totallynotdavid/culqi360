import { join } from "node:path";

import type { UserId } from "~/domain/ids";
import type { Phone } from "~/domain/phone/pe-mobile";
import { createUserChannelAddressRepo } from "~/server/notifications/repos/user-channel-address";
import type { AppContext } from "~/server/platform/action/context";
import type { UploadsConfig } from "~/server/platform/config/env";
import { createBlobStore } from "~/server/platform/files/blob-store";
import type { ServerInfrastructure } from "~/server/platform/infrastructure";
import type {
  ChangeMemberRoleCommand,
  UpdateMemberExpiryCommand,
  UpdateMemberProfileCommand,
} from "~/server/users/application/contracts";
import { getMemberDetail } from "~/server/users/application/queries/get-member-detail";
import { listBranchMembers } from "~/server/users/application/queries/list-branch-members";
import { changeMemberRole } from "~/server/users/application/use-cases/change-member-role";
import { deactivateMember } from "~/server/users/application/use-cases/deactivate-member";
import { deleteMember } from "~/server/users/application/use-cases/delete-member";
import { generateMemberResetLink } from "~/server/users/application/use-cases/generate-member-reset-link";
import { reactivateMember } from "~/server/users/application/use-cases/reactivate-member";
import { removeMemberAvatar } from "~/server/users/application/use-cases/remove-member-avatar";
import { updateMemberAvatar } from "~/server/users/application/use-cases/update-member-avatar";
import { updateMemberExpiry } from "~/server/users/application/use-cases/update-member-expiry";
import { updateMemberProfile } from "~/server/users/application/use-cases/update-member-profile";
import { createAvatarService } from "~/server/users/avatar-service";
import { createMemberWriteContext } from "~/server/users/infrastructure/member-write-context";
import { createBranchesRepo } from "~/server/users/repos-branches";
import { createTeamsRepo } from "~/server/users/repos-teams";
import { createUsersRepo } from "~/server/users/repos-users";
import { Err, Ok, type Result } from "~/shared/result";

export function createUsersRuntime(
  serverInfrastructure: ServerInfrastructure,
  uploads: UploadsConfig,
  publicOrigin: string,
) {
  const usersRepo = createUsersRepo(serverInfrastructure.db);
  const avatarService = createAvatarService(
    { users: usersRepo },
    createBlobStore(join(uploads.storageRoot, "avatars")),
  );
  const userChannelAddressesRepo = createUserChannelAddressRepo(
    serverInfrastructure.db,
  );

  const readDeps = {
    users: usersRepo,
    teams: createTeamsRepo(serverInfrastructure.db),
    branches: createBranchesRepo(serverInfrastructure.db),
  };
  const writeDeps = createMemberWriteContext(serverInfrastructure.db);
  const avatarDeps = {
    users: usersRepo,
    avatars: avatarService,
  };

  const members = {
    listRoster: (ctx: AppContext) => listBranchMembers(ctx, readDeps),
    getDetail: (ctx: AppContext, userId: UserId) =>
      getMemberDetail(ctx, readDeps, userId),
    updateProfile: (ctx: AppContext, command: UpdateMemberProfileCommand) =>
      updateMemberProfile(ctx, writeDeps, command),
    changeRole: (ctx: AppContext, command: ChangeMemberRoleCommand) =>
      changeMemberRole(ctx, writeDeps, command),
    deactivate: (ctx: AppContext, userId: UserId) =>
      deactivateMember(ctx, writeDeps, userId),
    reactivate: (ctx: AppContext, userId: UserId) =>
      reactivateMember(ctx, writeDeps, userId),
    updateExpiry: (ctx: AppContext, command: UpdateMemberExpiryCommand) =>
      updateMemberExpiry(ctx, writeDeps, command),
    remove: (ctx: AppContext, userId: UserId) =>
      deleteMember(ctx, writeDeps, userId),
    generateResetLink: (ctx: AppContext, userId: UserId) =>
      generateMemberResetLink(ctx, { ...writeDeps, publicOrigin }, userId),
    uploadAvatar: (ctx: AppContext, command: { userId: UserId; file: File }) =>
      updateMemberAvatar(ctx, avatarDeps, command),
    removeAvatar: (ctx: AppContext, userId: UserId) =>
      removeMemberAvatar(ctx, avatarDeps, userId),
  };

  async function updatePhone(
    userId: UserId,
    phone: Phone,
    claimedAt: Date,
  ): Promise<Result<void, { kind: "address_already_claimed" }>> {
    const claimResult = await userChannelAddressesRepo.claimWhatsAppAddress({
      userId,
      address: phone,
      claimedAt,
    });

    if (claimResult.kind === "already_claimed") {
      return Err({
        kind: "address_already_claimed",
      });
    }

    return Ok(undefined);
  }

  return {
    avatars: avatarService,
    updatePhone,
    members,
  };
}

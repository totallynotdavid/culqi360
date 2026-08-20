import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import type { CreateTeamInviteInput } from "~/contracts/team";
import { inviteManagementQuery } from "~/rpc/team-management/invite-management";
import {
  createTeamInvite,
  resendTeamInvite,
  revokeTeamInvite,
} from "~/rpc/team/invites";

export const createTeamInviteMutation = action(
  async (input: CreateTeamInviteInput) => {
    const { message, inviteUrl, delivered } = await createTeamInvite(input);

    return respond(
      { message, inviteUrl, delivered },
      { revalidate: inviteManagementQuery.key },
    );
  },
  "createTeamInvite",
);

export const resendTeamInviteMutation = action(async (inviteId: string) => {
  const { message } = await resendTeamInvite(inviteId);

  return respond({ message }, { revalidate: inviteManagementQuery.key });
}, "resendTeamInvite");

export const revokeTeamInviteMutation = action(async (inviteId: string) => {
  const { message } = await revokeTeamInvite(inviteId);

  return respond({ message }, { revalidate: inviteManagementQuery.key });
}, "revokeTeamInvite");

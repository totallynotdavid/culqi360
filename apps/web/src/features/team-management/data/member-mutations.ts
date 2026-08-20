import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import type {
  ChangeMemberRoleInput,
  UpdateMemberExpiryInput,
  UpdateMemberProfileInput,
} from "~/contracts/members";
import { memberDetailQuery } from "~/rpc/team-management/member-detail";
import { membersRosterQuery } from "~/rpc/team-management/members-roster";
import {
  startImpersonation,
  stopImpersonation,
} from "~/rpc/users/impersonation";
import {
  changeMemberRole,
  deactivateMember,
  deleteMember,
  reactivateMember,
  updateMemberExpiry,
  updateMemberProfile,
} from "~/rpc/users/write";

const revalidateMember = [membersRosterQuery.key, memberDetailQuery.key];

export const updateMemberProfileMutation = action(
  async (input: UpdateMemberProfileInput) => {
    const { message } = await updateMemberProfile(input);
    return respond({ message }, { revalidate: revalidateMember });
  },
  "updateMemberProfile",
);

export const changeMemberRoleMutation = action(
  async (input: ChangeMemberRoleInput) => {
    const { message } = await changeMemberRole(input);
    return respond({ message }, { revalidate: revalidateMember });
  },
  "changeMemberRole",
);

export const deactivateMemberMutation = action(async (userId: string) => {
  const { message } = await deactivateMember(userId);
  return respond({ message }, { revalidate: revalidateMember });
}, "deactivateMember");

export const reactivateMemberMutation = action(async (userId: string) => {
  const { message } = await reactivateMember(userId);
  return respond({ message }, { revalidate: revalidateMember });
}, "reactivateMember");

export const updateMemberExpiryMutation = action(
  async (input: UpdateMemberExpiryInput) => {
    const { message } = await updateMemberExpiry(input);
    return respond({ message }, { revalidate: revalidateMember });
  },
  "updateMemberExpiry",
);

export const deleteMemberMutation = action(async (userId: string) => {
  const { message } = await deleteMember(userId);
  return respond({ message }, { revalidate: membersRosterQuery.key });
}, "deleteMember");

export const startImpersonationMutation = action(async (userId: string) => {
  const { message } = await startImpersonation(userId);
  return respond({ message });
}, "startImpersonation");

export const stopImpersonationMutation = action(async () => {
  const { message } = await stopImpersonation();
  return respond({ message });
}, "stopImpersonation");

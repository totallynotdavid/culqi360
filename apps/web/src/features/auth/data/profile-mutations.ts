import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import { meQuery } from "~/rpc/auth/me";
import { removeUserAvatar, uploadUserAvatar } from "~/rpc/settings/avatar";
import { updateUserProfile } from "~/rpc/settings/profile";

export const updateUserProfileMutation = action(
  async (phone: string) =>
    respond(await updateUserProfile(phone), { revalidate: [meQuery.key] }),
  "updateUserProfile",
);

export const uploadUserAvatarMutation = action(async (formData: FormData) => {
  return uploadUserAvatar(formData);
}, "uploadUserAvatar");

export const removeUserAvatarMutation = action(async () => {
  return removeUserAvatar();
}, "removeUserAvatar");

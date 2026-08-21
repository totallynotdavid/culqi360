import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import { getUserLoginRetryReport } from "~/rpc/admin/auth-security";
import { meQuery } from "~/rpc/auth/me";
import {
  acknowledgeRecoveryCodes,
  regenerateRecoveryCodes,
} from "~/rpc/auth/recovery-codes";
import { recoveryCodesStatusQuery } from "~/rpc/auth/recovery-codes";
import {
  changePassword,
  disableTotp,
  removeAllPasskeys,
} from "~/rpc/settings/security";

const SECURITY_STATUS_KEYS = [meQuery.key, recoveryCodesStatusQuery.key];

export const removeAllPasskeysMutation = action(
  async () =>
    respond(await removeAllPasskeys(), { revalidate: SECURITY_STATUS_KEYS }),
  "settingsRemoveAllPasskeys",
);

export const disableTotpMutation = action(
  async () =>
    respond(await disableTotp(), { revalidate: SECURITY_STATUS_KEYS }),
  "settingsDisableTotp",
);

export const regenerateRecoveryCodesMutation = action(
  async () =>
    respond(await regenerateRecoveryCodes(), {
      revalidate: SECURITY_STATUS_KEYS,
    }),
  "settingsRegenerateRecoveryCodes",
);

export const acknowledgeRecoveryCodesMutation = action(
  async () =>
    respond(await acknowledgeRecoveryCodes(), {
      revalidate: SECURITY_STATUS_KEYS,
    }),
  "settingsAcknowledgeRecoveryCodes",
);

export const changePasswordMutation = action(
  (currentPassword: string, newPassword: string) =>
    changePassword(currentPassword, newPassword),
  "settingsChangePassword",
);

export const loginRetryReportMutation = action(
  (email: string) => getUserLoginRetryReport(email),
  "settingsLoginRetryReport",
);

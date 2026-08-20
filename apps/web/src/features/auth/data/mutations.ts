import { action } from "@solidjs/router";
import { redirect } from "@solidjs/web";

import type {
  PasskeyStartSubmissionResult,
  PasswordLoginSubmissionResult,
} from "~/contracts/auth";
import { acceptInvitePasswordStep } from "~/rpc/auth/invite";
import {
  passkeyStart,
  passwordLogin,
  recoveryLogin,
  totpLogin,
} from "~/rpc/auth/login/index";
import { requestPasswordReset, resetPassword } from "~/rpc/auth/reset-password";
import { logout } from "~/rpc/auth/session/index";

export const logoutMutation = action(logout, "logout");

export const passwordLoginMutation = action(
  async (formData: FormData): Promise<PasswordLoginSubmissionResult> =>
    passwordLogin(formData),
  "passwordLogin",
);

export const passkeyStartMutation = action(
  async (formData: FormData): Promise<PasskeyStartSubmissionResult> =>
    passkeyStart(formData),
  "passkeyStart",
);

export const totpLoginMutation = action(
  async (formData: FormData): Promise<void> => totpLogin(formData),
  "totpLogin",
);

export const recoveryLoginMutation = action(
  async (formData: FormData): Promise<void> => recoveryLogin(formData),
  "recoveryLogin",
);

export const requestPasswordResetMutation = action(
  async (formData: FormData): Promise<{ ok: true }> =>
    requestPasswordReset(formData),
  "requestPasswordReset",
);

export const resetPasswordMutation = action(
  async (formData: FormData): Promise<{ ok: true }> => resetPassword(formData),
  "resetPassword",
);

export const acceptInvitePasswordMutation = action(
  async (formData: FormData) => {
    const token = formData.get("token");
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");
    const result = await acceptInvitePasswordStep({
      token: typeof token === "string" ? token : "",
      password: typeof password === "string" ? password : "",
      confirmPassword:
        typeof confirmPassword === "string" ? confirmPassword : undefined,
    });
    throw redirect(result.redirectTo);
  },
  "acceptInvitePassword",
);

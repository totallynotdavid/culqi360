import { createSignal } from "solid-js";

import { actionErrorMessage } from "~/contracts/errors";
import {
  beginTotpEnrollment,
  finishTotpEnrollment,
} from "~/rpc/auth/security/totp";

interface TotpEnrollmentState {
  qrCodeDataUrl: string;
  otpauthUri: string;
}

interface TotpEnrollmentOptions {
  enqueueSuccessSnackBar: (message: string) => void;
  enqueueErrorSnackBar: (message: string) => void;
  refreshStatus: () => void | PromiseLike<unknown>;
  onRecoveryCodes?: (codes: string[]) => void;
}

export function useTotpEnrollment(options: TotpEnrollmentOptions) {
  const [loading, setLoading] = createSignal(false);
  const [code, setCode] = createSignal("");
  const [enrollment, setEnrollment] = createSignal<TotpEnrollmentState | null>(
    null,
  );
  const [recoveryCodes, setRecoveryCodes] = createSignal<string[]>([]);

  async function beginEnrollment() {
    setLoading(true);

    try {
      const enrollmentState = await beginTotpEnrollment();

      setEnrollment(enrollmentState);
    } catch (caught) {
      options.enqueueErrorSnackBar(actionErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function verifyEnrollment() {
    setLoading(true);

    try {
      const { recoveryCodes: codes, message } =
        await finishTotpEnrollment(code());

      setRecoveryCodes(codes);
      setEnrollment(null);
      setCode("");

      if (codes.length > 0) {
        options.onRecoveryCodes?.(codes);
      } else {
        await options.refreshStatus();
      }

      options.enqueueSuccessSnackBar(message);
    } catch (caught) {
      options.enqueueErrorSnackBar(actionErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setLoading(false);
    setCode("");
    setEnrollment(null);
    setRecoveryCodes([]);
  }

  return {
    loading,
    code,
    enrollment,
    recoveryCodes,
    setCode,
    beginEnrollment,
    verifyEnrollment,
    reset,
  };
}

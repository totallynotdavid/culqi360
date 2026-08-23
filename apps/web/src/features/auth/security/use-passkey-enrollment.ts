import { createSignal, onSettled } from "solid-js";

import {
  createRegistrationResponse,
  isPasskeyRegistrationSupported,
} from "~/browser/auth/passkey/registration-client";
import { actionErrorMessage } from "~/contracts/errors";
import {
  beginPasskeyEnrollment,
  finishPasskeyEnrollment,
} from "~/rpc/auth/security/passkey";

interface PasskeyEnrollmentOptions {
  enqueueSuccessSnackBar: (message: string) => void;
  enqueueErrorSnackBar: (message: string) => void;
  refreshStatus: () => void | PromiseLike<unknown>;
  onRecoveryCodes?: (codes: string[]) => void;
}

export function usePasskeyEnrollment(options: PasskeyEnrollmentOptions) {
  const [supported, setSupported] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  onSettled(() => {
    setSupported(isPasskeyRegistrationSupported());
  });

  async function enrollPasskey() {
    setLoading(true);
    try {
      const { challengeId, options: registrationOptions } =
        await beginPasskeyEnrollment();
      const { message, recoveryCodes } = await finishPasskeyEnrollment(
        challengeId,
        await createRegistrationResponse(registrationOptions),
      );
      if (recoveryCodes.length > 0) {
        options.onRecoveryCodes?.(recoveryCodes);
      } else {
        await options.refreshStatus();
      }
      options.enqueueSuccessSnackBar(message);
    } catch (caught: unknown) {
      options.enqueueErrorSnackBar(actionErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return {
    supported,
    loading,
    enrollPasskey,
  };
}

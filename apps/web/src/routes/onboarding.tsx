import {
  useNavigate,
  useSearchParams,
  type RouteDefinition,
} from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  onSettled,
  Show,
  Loading,
  Switch,
} from "solid-js";

import {
  createRegistrationResponse,
  isPasskeyRegistrationSupported,
} from "~/browser/auth/passkey/registration-client";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { Loader } from "~/components/feedback/spinner/loader";
import type { OnboardingSnapshot } from "~/contracts/auth";
import { actionErrorMessage } from "~/contracts/errors";
import { normalizePhoneInput, isValidPhone } from "~/domain/phone/pe-mobile";
import {
  resolveOnboardingStep,
  type RequestedSecurityStep,
} from "~/features/onboarding/model/resolve-step";
import { OnboardingPasskeyStep } from "~/features/onboarding/ui/onboarding-passkey-step";
import type { PasskeyPhase } from "~/features/onboarding/ui/onboarding-passkey-step";
import { OnboardingPasswordStep } from "~/features/onboarding/ui/onboarding-password-step";
import { OnboardingProfileStep } from "~/features/onboarding/ui/onboarding-profile-step";
import { OnboardingSecurityStep } from "~/features/onboarding/ui/onboarding-security-step";
import { OnboardingShell } from "~/features/onboarding/ui/onboarding-shell";
import { OnboardingTotpStep } from "~/features/onboarding/ui/onboarding-totp-step";
import { changeOnboardingPassword } from "~/rpc/auth/onboarding/change-password";
import { completeOnboardingAction } from "~/rpc/auth/onboarding/complete";
import { submitOnboardingProfile } from "~/rpc/auth/onboarding/submit-profile";
import { acknowledgeRecoveryCodes } from "~/rpc/auth/recovery-codes";
import { beginPasskeyEnrollment } from "~/rpc/auth/security/passkey";
import { beginTotpEnrollment } from "~/rpc/auth/security/totp";
import { onboardingSnapshotQuery } from "~/rpc/onboarding/onboarding-snapshot";

import styles from "~/features/onboarding/ui/onboarding-page.module.css";

export const route = {
  preload: () => onboardingSnapshotQuery(),
} satisfies RouteDefinition;

function parseRequestedStep(
  raw: string | string[] | undefined,
): RequestedSecurityStep {
  if (Array.isArray(raw)) {
    return null;
  }

  return raw === "passkey" || raw === "totp" ? raw : null;
}

function OnboardingContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const loadedSnapshot = createMemo(() => onboardingSnapshotQuery(), {
    deferStream: true,
  });
  const [localSnapshot, setLocalSnapshot] = createSignal<OnboardingSnapshot>();
  const snapshot = () => localSnapshot() ?? loadedSnapshot();

  const [phone, setPhone] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  const [passkeySupported, setPasskeySupported] = createSignal(false);
  const [passkeyPhase, setPasskeyPhase] = createSignal<PasskeyPhase>("idle");

  const [totpLoading, setTotpLoading] = createSignal(false);
  const [totpEnrollment, setTotpEnrollment] = createSignal<{
    otpauthUri: string;
    qrCodeDataUrl: string;
  } | null>(null);
  const [totpStartAttempted, setTotpStartAttempted] = createSignal(false);
  const [totpCode, setTotpCode] = createSignal("");

  const [recoveryCodes, setRecoveryCodes] = createSignal<string[]>([]);

  // Seeded once rather than derived: the snapshot query revalidates after every
  // onboarding mutation, and a writable memo would overwrite what is being typed.
  let initializedPhone = false;

  createEffect(
    () => snapshot()?.user.phone,
    (value) => {
      if (initializedPhone || value === undefined) {
        return;
      }

      initializedPhone = true;
      setPhone(value ?? "");
    },
  );

  onSettled(() => {
    setPasskeySupported(isPasskeyRegistrationSupported());
  });

  const requestedStep = createMemo(() => parseRequestedStep(searchParams.step));

  const step = createMemo(() => {
    const current = snapshot();

    return current
      ? resolveOnboardingStep(current, requestedStep())
      : undefined;
  });

  // Only the step drives this. The enrollment guards are read in the effect
  // phase, which is untracked, so writing them no longer re-runs the effect
  // the way it did when every read was tracked.
  createEffect(step, (currentStep) => {
    if (currentStep !== "totp") {
      setTotpEnrollment(null);
      setTotpStartAttempted(false);
      return;
    }

    if (totpEnrollment() || totpLoading() || totpStartAttempted()) {
      return;
    }

    setTotpStartAttempted(true);
    setTotpLoading(true);

    void beginTotpEnrollment()
      .then(setTotpEnrollment)
      .catch((error: unknown) => {
        enqueueErrorSnackBar(actionErrorMessage(error));
      })
      .finally(() => {
        setTotpLoading(false);
      });
  });

  function applyCompletion(
    result: Awaited<ReturnType<typeof completeOnboardingAction>>,
  ) {
    if (result.recoveryCodes.length === 0) {
      navigate(result.redirectTo);
      return;
    }

    setRecoveryCodes(result.recoveryCodes);
  }

  async function handlePasswordSubmit() {
    setSubmitting(true);

    try {
      await changeOnboardingPassword({
        password: password(),
        confirmPassword: confirmPassword(),
      });

      // Changing the password revokes this session. Signing in again resumes
      // onboarding from the persisted user state.
      enqueueSuccessSnackBar(
        "Contraseña actualizada. Inicia sesión nuevamente para continuar.",
      );
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProfileSubmit() {
    const normalizedPhone = normalizePhoneInput(phone());

    setPhone(normalizedPhone);

    if (!isValidPhone(normalizedPhone)) {
      return;
    }

    setSubmitting(true);

    try {
      setLocalSnapshot(
        await submitOnboardingProfile({ phone: normalizedPhone }),
      );
    } catch (error: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteWithoutFactor() {
    setSubmitting(true);

    try {
      const result = await completeOnboardingAction({ method: "none" });
      navigate(result.redirectTo);
    } catch (error: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasskeySetup() {
    if (!passkeySupported()) {
      enqueueErrorSnackBar(
        "Este dispositivo no es compatible con claves de acceso.",
      );
      return;
    }

    setPasskeyPhase("device");

    try {
      const { challengeId, options } = await beginPasskeyEnrollment();
      const response = await createRegistrationResponse(options);

      setPasskeyPhase("server");

      const result = await completeOnboardingAction({
        method: "passkey",
        challengeId,
        response,
      });

      applyCompletion(result);
    } catch (error: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    } finally {
      setPasskeyPhase("idle");
    }
  }

  async function handleTotpVerify() {
    if (!/^\d{6}$/.test(totpCode())) {
      return;
    }

    setTotpLoading(true);

    try {
      const result = await completeOnboardingAction({
        method: "totp",
        code: totpCode(),
      });

      applyCompletion(result);
    } catch (error: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    } finally {
      setTotpLoading(false);
    }
  }

  async function handleRecoveryCodesComplete() {
    setSubmitting(true);

    try {
      const result = await acknowledgeRecoveryCodes();
      navigate(result.redirectTo);
    } catch (error: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Show when={snapshot()} keyed>
      {(current) => (
        <OnboardingShell
          onBack={
            (step() === "passkey" || step() === "totp") &&
            recoveryCodes().length === 0
              ? () => navigate("/onboarding")
              : undefined
          }
        >
          <Switch>
            <Match when={step() === "password"}>
              <OnboardingPasswordStep
                email={current.user.email}
                password={password()}
                confirmPassword={confirmPassword()}
                submitting={submitting()}
                onPasswordInput={setPassword}
                onConfirmPasswordInput={setConfirmPassword}
                onSubmit={() => void handlePasswordSubmit()}
              />
            </Match>

            <Match when={step() === "profile"}>
              <OnboardingProfileStep
                email={current.user.email}
                fullName={`${current.user.names} ${current.user.firstSurname} ${current.user.secondSurname}`}
                role={current.user.role}
                phone={phone()}
                submitting={submitting()}
                onPhoneInput={setPhone}
                onSubmit={() => void handleProfileSubmit()}
              />
            </Match>

            <Match when={step() === "security"}>
              <OnboardingSecurityStep
                hasPasskey={current.hasPasskey}
                totpEnabled={current.totpEnabled}
                securityRequired={current.strongAuthRequired}
                finishing={submitting()}
                onSelectPasskey={() => navigate("/onboarding?step=passkey")}
                onSelectTotp={() => navigate("/onboarding?step=totp")}
                onFinishWithoutSecurity={() =>
                  void handleCompleteWithoutFactor()
                }
              />
            </Match>

            <Match when={step() === "passkey"}>
              <OnboardingPasskeyStep
                phase={passkeyPhase()}
                recoveryCodes={recoveryCodes()}
                finishing={submitting()}
                onSetup={() => void handlePasskeySetup()}
                onComplete={() => void handleRecoveryCodesComplete()}
              />
            </Match>

            <Match when={step() === "totp"}>
              <OnboardingTotpStep
                enrollment={totpEnrollment()}
                loading={totpLoading()}
                code={totpCode()}
                recoveryCodes={recoveryCodes()}
                finishing={submitting()}
                onCodeInput={setTotpCode}
                onVerify={() => void handleTotpVerify()}
                onComplete={() => void handleRecoveryCodesComplete()}
              />
            </Match>
          </Switch>
        </OnboardingShell>
      )}
    </Show>
  );
}

export default function OnboardingPage() {
  return (
    <Loading
      fallback={
        <OnboardingShell centered>
          <output class={styles.loaderCenter} aria-live="polite">
            <Loader />
          </output>
        </OnboardingShell>
      }
    >
      <OnboardingContent />
    </Loading>
  );
}

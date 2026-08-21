import { useAction } from "@solidjs/router";
import { createSignal, onCleanup } from "solid-js";

import { createActionPending } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Button } from "~/components/ui/input/button";
import { ImageInput } from "~/components/ui/input/image-input";
import { Input } from "~/components/ui/input/input";
import { actionErrorMessage } from "~/contracts/errors";
import { isValidPhone, normalizePhoneInput } from "~/domain/phone/pe-mobile";
import {
  removeUserAvatarMutation,
  updateUserProfileMutation,
  uploadUserAvatarMutation,
} from "~/features/auth/data/profile-mutations";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";

import styles from "./settings-page.module.css";

export default function ProfilePage() {
  const { currentUser, updateCurrentUser } = useAuthenticatedSession();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [profilePhone, setProfilePhone] = createSignal(
    currentUser().phone || "",
  );
  const [avatarPreviewUrl, setAvatarPreviewUrl] = createSignal<string | null>(
    null,
  );
  const [avatarErrorMessage, setAvatarErrorMessage] = createSignal<
    string | null
  >(null);

  const uploadAvatar = useAction(uploadUserAvatarMutation);
  const removeAvatar = useAction(removeUserAvatarMutation);
  const updateProfile = useAction(updateUserProfileMutation);

  const savingPhone = createActionPending(updateUserProfileMutation);
  const uploadingAvatar = createActionPending(uploadUserAvatarMutation);
  const removingAvatar = createActionPending(removeUserAvatarMutation);

  const avatarMutationPending = () => uploadingAvatar() || removingAvatar();

  const phoneFormId = "settings-profile-phone-form";

  function clearAvatarPreview() {
    const preview = avatarPreviewUrl();

    if (!preview) {
      return;
    }

    URL.revokeObjectURL(preview);
    setAvatarPreviewUrl(null);
  }

  onCleanup(clearAvatarPreview);

  async function savePhone(event: SubmitEvent) {
    event.preventDefault();

    const phone = normalizePhoneInput(profilePhone());
    setProfilePhone(phone);

    if (!isValidPhone(phone)) {
      enqueueErrorSnackBar("Ingresa 9 dígitos y que empiece con 9");
      return;
    }

    try {
      const { message } = await updateProfile(phone);

      updateCurrentUser((existing) => ({
        ...existing,
        phone,
      }));

      enqueueSuccessSnackBar(message);
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  async function handleAvatarUpload(file: File) {
    setAvatarErrorMessage(null);
    clearAvatarPreview();
    setAvatarPreviewUrl(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.set("file", file);

      const updated = await uploadAvatar(formData);

      updateCurrentUser((existing) => ({
        ...existing,
        avatarUrl: updated.avatarUrl,
        avatarVersion: updated.avatarVersion,
      }));

      enqueueSuccessSnackBar(updated.message);
      clearAvatarPreview();
    } catch (caught: unknown) {
      clearAvatarPreview();

      const message = actionErrorMessage(caught);
      setAvatarErrorMessage(message);
      enqueueErrorSnackBar(message);
    }
  }

  async function handleAvatarRemove() {
    setAvatarErrorMessage(null);
    clearAvatarPreview();

    try {
      const updated = await removeAvatar();

      updateCurrentUser((existing) => ({
        ...existing,
        avatarUrl: null,
        avatarVersion: updated.avatarVersion,
      }));

      enqueueSuccessSnackBar(updated.message);
    } catch (caught: unknown) {
      const message = actionErrorMessage(caught);
      setAvatarErrorMessage(message);
      enqueueErrorSnackBar(message);
    }
  }

  return (
    <SettingsPageLayout>
      <SettingsSection title="Foto">
        <ImageInput
          pictureUrl={avatarPreviewUrl() ?? currentUser().avatarUrl}
          uploading={avatarMutationPending()}
          errorMessage={avatarErrorMessage()}
          onUpload={handleAvatarUpload}
          onRemove={handleAvatarRemove}
        />
      </SettingsSection>

      <SettingsSection
        title="Teléfono"
        description="Tu número de teléfono corporativo"
      >
        <form
          id={phoneFormId}
          onSubmit={(event) => {
            void savePhone(event);
          }}
        >
          <div class={styles.formGrid}>
            <Input
              label="Teléfono"
              value={profilePhone()}
              onInput={(event) =>
                setProfilePhone(normalizePhoneInput(event.currentTarget.value))
              }
              placeholder="987654321"
            />
          </div>

          <div class={styles.formActions}>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              loading={savingPhone()}
            >
              Guardar
            </Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Correo electrónico"
        description="El correo asociado a tu cuenta"
      >
        <Input value={currentUser().email} disabled />
      </SettingsSection>
    </SettingsPageLayout>
  );
}

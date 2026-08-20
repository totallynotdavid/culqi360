import { useAction } from "@solidjs/router";
import { For, Show, onCleanup } from "solid-js";
import { createStore } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { DatePicker } from "~/components/ui/date-picker/date-picker-field";
import { Input } from "~/components/ui/input/input";
import { Select } from "~/components/ui/input/select";
import { actionErrorMessage } from "~/contracts/errors";
import type { MemberDetail } from "~/contracts/members";
import { parseCalendarDate } from "~/domain/time/calendar-date";
import {
  updateMemberExpiryMutation,
  updateMemberProfileMutation,
} from "~/features/team-management/data/member-mutations";

import styles from "./team-management.module.css";

const PROFILE_SAVE_DELAY_MS = 400;
export function MemberInfoTab(props: { detail: MemberDetail }) {
  const initialDetail = props.detail;
  const updateProfile = useAction(updateMemberProfileMutation);
  const updateExpiry = useAction(updateMemberExpiryMutation);
  const { enqueueErrorSnackBar } = useSnackBar();

  const [draft, setDraft] = createStore({
    names: initialDetail.names,
    firstSurname: initialDetail.firstSurname,
    secondSurname: initialDetail.secondSurname,
    teamId: initialDetail.teamId ?? "",
    category: initialDetail.executiveCategory ?? "",
    expiresOn: initialDetail.expiresOn ?? "",
  });

  const disabled = () => !props.detail.canManage;

  let profileTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(profileTimer));

  async function saveProfile() {
    if (
      !draft.names.trim() ||
      !draft.firstSurname.trim() ||
      !draft.secondSurname.trim()
    ) {
      return;
    }
    try {
      await updateProfile({
        userId: props.detail.id,
        names: draft.names,
        firstSurname: draft.firstSurname,
        secondSurname: draft.secondSurname,
        teamId: draft.teamId || null,
        executiveCategory: draft.category || null,
      });
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  function scheduleProfileSave() {
    clearTimeout(profileTimer);
    profileTimer = setTimeout(() => void saveProfile(), PROFILE_SAVE_DELAY_MS);
  }

  // Discrete selects commit immediately rather than waiting on the debounce.
  function saveProfileNow() {
    clearTimeout(profileTimer);
    void saveProfile();
  }

  async function saveExpiry(value: string) {
    try {
      await updateExpiry({
        userId: props.detail.id,
        expiresOn: value || null,
      });
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  return (
    <>
      <SettingsSection
        title="Datos del usuario"
        description="Nombre, equipo y categoría del miembro."
      >
        <div class={styles.fieldStack}>
          <div class={styles.fieldRow}>
            <Input
              label="Nombres"
              value={draft.names}
              onInput={(event) => {
                const names = event.currentTarget.value;
                setDraft((current) => {
                  current.names = names;
                });
                scheduleProfileSave();
              }}
              disabled={disabled()}
              required
            />
            <Input
              label="Primer apellido"
              value={draft.firstSurname}
              onInput={(event) => {
                const firstSurname = event.currentTarget.value;
                setDraft((current) => {
                  current.firstSurname = firstSurname;
                });
                scheduleProfileSave();
              }}
              disabled={disabled()}
              required
            />
            <Input
              label="Segundo apellido"
              value={draft.secondSurname}
              onInput={(event) => {
                const secondSurname = event.currentTarget.value;
                setDraft((current) => {
                  current.secondSurname = secondSurname;
                });
                scheduleProfileSave();
              }}
              disabled={disabled()}
              required
            />
          </div>

          <div class={styles.fieldRow}>
            <Select
              label="Equipo"
              value={draft.teamId}
              onInput={(event) => {
                const teamId = event.currentTarget.value;
                setDraft((current) => {
                  current.teamId = teamId;
                });
                saveProfileNow();
              }}
              disabled={disabled()}
            >
              <option value="">Sin equipo</option>
              <For each={props.detail.teams}>
                {(team) => <option value={team.id}>{team.name}</option>}
              </For>
            </Select>

            <Show when={props.detail.role === "executive"}>
              <Select
                label="Categoría"
                value={draft.category}
                onInput={(event) => {
                  const category = event.currentTarget.value;
                  setDraft((current) => {
                    current.category = category;
                  });
                  saveProfileNow();
                }}
                disabled={disabled()}
                required
              >
                <option value="">Seleccionar categoría...</option>
                <option value="elite">Elite</option>
                <option value="corporativa">Corporativa</option>
              </Select>
            </Show>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Correo electrónico">
        <Input value={props.detail.email} disabled />
      </SettingsSection>

      <SettingsSection
        title="Vencimiento de la cuenta"
        description="Si defines una fecha, la cuenta se desactiva automáticamente al llegar."
      >
        <DatePicker
          label="Fecha de vencimiento"
          value={draft.expiresOn}
          disabled={disabled()}
          onInput={(value) => {
            setDraft((current) => {
              current.expiresOn = value;
            });
            if (!value || parseCalendarDate(value)) {
              void saveExpiry(value);
            }
          }}
        />
      </SettingsSection>
    </>
  );
}

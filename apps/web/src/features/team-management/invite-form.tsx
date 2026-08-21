import { useAction } from "@solidjs/router";
import { For, Show, createEffect, createSignal } from "solid-js";

import { createActionPending } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { DatePicker } from "~/components/ui/date-picker/date-picker-field";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import { Select } from "~/components/ui/input/select";
import { codeIs } from "~/contracts/error-codes";
import { parseWireError } from "~/contracts/errors";
import type { InviteManagement } from "~/contracts/team";
import { createTeamInviteMutation } from "~/features/team-management/data/team-mutations";

import {
  getInviteExpiryFieldError,
  getMinInviteExpiryDate,
  INVITE_EXPIRY_ERROR_TEXT,
  INVITE_EXPIRY_HELPER_TEXT,
  parseInviteExpiryDate,
} from "./team-invite-expiry";

import styles from "./team-management.module.css";

export function InviteForm(props: {
  setup: InviteManagement;
  evaluatedAt: number;
}) {
  const createInvite = useAction(createTeamInviteMutation);
  const inviting = createActionPending(createTeamInviteMutation);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [names, setNames] = createSignal("");
  const [firstSurname, setFirstSurname] = createSignal("");
  const [secondSurname, setSecondSurname] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [role, setRole] = createSignal("");
  const [executiveCategory, setExecutiveCategory] = createSignal("");
  const [teamId, setTeamId] = createSignal("");
  const [expiresOn, setExpiresOn] = createSignal("");
  const [expiresOnErrorMessage, setExpiresOnErrorMessage] = createSignal<
    string | undefined
  >();

  // Keep the link available when email delivery fails.
  const [issuedLink, setIssuedLink] = createSignal<{
    url: string;
    delivered: boolean;
  } | null>(null);

  // Reset the role if updated permissions no longer allow it.
  createEffect(
    () => props.setup,
    (setup) => {
      const roleStillAssignable = setup.assignableRoles.some(
        (option) => option.value === role(),
      );

      if (!roleStillAssignable) {
        setRole(getDefaultAssignableRole(setup));
      }
    },
  );

  function resetForm() {
    setNames("");
    setFirstSurname("");
    setSecondSurname("");
    setEmail("");
    setRole(getDefaultAssignableRole(props.setup));
    setExecutiveCategory("");
    setTeamId("");
    setExpiresOn("");
    setExpiresOnErrorMessage(undefined);
  }

  async function handleCopyLink(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      enqueueSuccessSnackBar("Enlace de invitación copiado");
    } catch {
      enqueueErrorSnackBar("No se pudo copiar el enlace");
    }
  }

  async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    setIssuedLink(null);

    const parsedExpiresOn = parseInviteExpiryDate(
      expiresOn(),
      props.evaluatedAt,
    );

    if (parsedExpiresOn.isErr) {
      setExpiresOnErrorMessage(parsedExpiresOn.error);
      return;
    }

    try {
      const result = await createInvite({
        names: names(),
        firstSurname: firstSurname(),
        secondSurname: secondSurname(),
        email: email(),
        role: role(),
        executiveCategory: executiveCategory() || null,
        teamId: teamId() || null,
        expiresOn: parsedExpiresOn.value,
      });

      resetForm();
      setIssuedLink({
        url: result.inviteUrl,
        delivered: result.delivered,
      });
      enqueueSuccessSnackBar(result.message);
    } catch (caught: unknown) {
      const wire = parseWireError(caught);

      if (codeIs(wire, "expires_on_too_soon")) {
        setExpiresOnErrorMessage(INVITE_EXPIRY_ERROR_TEXT);
        return;
      }

      enqueueErrorSnackBar(wire.message);
    }
  }

  return (
    <form
      class={styles.fieldStack}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div class={styles.fieldRow}>
        <Input
          label="Nombres"
          value={names()}
          onInput={(event) => setNames(event.currentTarget.value)}
          required
        />

        <Input
          label="Primer apellido"
          value={firstSurname()}
          onInput={(event) => setFirstSurname(event.currentTarget.value)}
          required
        />

        <Input
          label="Segundo apellido"
          value={secondSurname()}
          onInput={(event) => setSecondSurname(event.currentTarget.value)}
          required
        />
      </div>

      <Input
        type="email"
        label="Correo corporativo"
        value={email()}
        onInput={(event) => setEmail(event.currentTarget.value)}
        required
      />

      <div class={styles.fieldRow}>
        <Select
          label="Rol"
          value={role()}
          onInput={(event) => {
            setRole(event.currentTarget.value);
            setExecutiveCategory("");
          }}
          required
        >
          <For each={props.setup.assignableRoles}>
            {(option) => <option value={option.value}>{option.label}</option>}
          </For>
        </Select>

        <Show when={role() === "executive"}>
          <Select
            label="Categoría"
            value={executiveCategory()}
            onInput={(event) => setExecutiveCategory(event.currentTarget.value)}
            required
          >
            <option value="">Seleccionar categoría...</option>
            <option value="elite">Elite</option>
            <option value="corporativa">Corporativa</option>
          </Select>
        </Show>
      </div>

      <div class={styles.fieldRow}>
        <Select
          label="Equipo"
          value={teamId()}
          onInput={(event) => setTeamId(event.currentTarget.value)}
        >
          <option value="">Sin equipo</option>
          <For each={props.setup.teams}>
            {(team) => <option value={team.id}>{team.name}</option>}
          </For>
        </Select>

        <DatePicker
          label="Fecha de vencimiento"
          value={expiresOn()}
          min={getMinInviteExpiryDate(props.evaluatedAt)}
          description={INVITE_EXPIRY_HELPER_TEXT}
          error={expiresOnErrorMessage()}
          onInput={(nextValue) => {
            setExpiresOn(nextValue);
            setExpiresOnErrorMessage(
              getInviteExpiryFieldError(nextValue, props.evaluatedAt),
            );
          }}
        />
      </div>

      <div class={styles.inviteActions}>
        <Button
          type="submit"
          loading={inviting()}
          disabled={
            !role() ||
            (role() === "executive" && !executiveCategory()) ||
            expiresOnErrorMessage() !== undefined
          }
        >
          Enviar invitación
        </Button>
      </div>

      <Show when={issuedLink()}>
        {(link) => (
          <div class={styles.issuedLink}>
            <span class={styles.issuedLinkLabel}>
              {link().delivered
                ? "Enlace de invitación"
                : "Correo no enviado. Comparte este enlace directamente:"}
            </span>

            <div class={styles.issuedLinkRow}>
              <span class={styles.issuedLinkUrl}>{link().url}</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCopyLink(link().url)}
              >
                Copiar enlace
              </Button>
            </div>
          </div>
        )}
      </Show>
    </form>
  );
}

function getDefaultAssignableRole(setup: InviteManagement): string {
  return setup.assignableRoles[0]?.value ?? "";
}

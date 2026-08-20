import { Show, createMemo } from "solid-js";

import { SettingsSection } from "~/components/settings/SettingsSection";
import { inviteManagementQuery } from "~/rpc/team-management/invite-management";

import { InviteForm } from "./invite-form";
import { PendingInvitesTable } from "./pending-invites-table";

export function TeamInviteManagementSection() {
  const inviteManagement = createMemo(() => inviteManagementQuery());

  return (
    <Show when={inviteManagement()}>
      {(im) => (
        <SettingsSection
          title="Invitar por correo"
          description="Envía una invitación por correo a nuevos miembros del equipo."
        >
          <InviteForm setup={im()} evaluatedAt={im().evaluatedAt} />
          <PendingInvitesTable
            invites={im().pendingInvites}
            evaluatedAt={im().evaluatedAt}
          />
        </SettingsSection>
      )}
    </Show>
  );
}

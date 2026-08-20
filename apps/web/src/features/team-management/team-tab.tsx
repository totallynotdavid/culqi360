import { useNavigate } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";

import ChevronRight from "~/components/icons/chevron-right";
import { getUserInitials } from "~/components/layout/account-menu-utils";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Avatar } from "~/components/ui/display/avatar";
import { Badge } from "~/components/ui/display/badge";
import { SearchInput } from "~/components/ui/input/search-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/layout/table";
import { OverflowingText } from "~/components/ui/overflow-tooltip/overflow-tooltip";
import type { MemberListItem } from "~/contracts/members";
import { shortName } from "~/domain/identity/display-name";
import { membersRosterQuery } from "~/rpc/team-management/members-roster";

import styles from "./team-management.module.css";

function statusBadge(member: MemberListItem) {
  if (!member.isActive) {
    return { variant: "secondary", label: "Inactivo" } as const;
  }
  if (!member.onboardingCompleted) {
    return { variant: "warning", label: "Pendiente" } as const;
  }
  return { variant: "success", label: "Activo" } as const;
}

export function TeamTab() {
  const navigate = useNavigate();
  const { currentUser } = useAuthenticatedSession();
  const roster = createMemo(() => membersRosterQuery());
  const [filter, setFilter] = createSignal("");

  const filtered = createMemo(() => {
    const members = roster()?.members ?? [];
    const value = filter().trim().toLowerCase();
    if (!value) {
      return members;
    }
    return members.filter((member) =>
      `${shortName(member)} ${member.email}`.toLowerCase().includes(value),
    );
  });

  const isSelf = (member: MemberListItem) => member.id === currentUser().id;

  // Roster never navigates into the actor's own row.
  function openMember(member: MemberListItem) {
    if (isSelf(member)) {
      return;
    }
    navigate(`/settings/members/${member.id}`);
  }

  return (
    <SettingsSection
      title="Miembros"
      description="Gestiona los miembros de tu espacio de trabajo."
    >
      <div class={styles.rosterSearch}>
        <SearchInput
          value={filter()}
          onValueChange={setFilter}
          placeholder="Buscar un miembro..."
          aria-label="Buscar miembro"
        />
      </div>

      <Table aria-label="Miembros del equipo" variant="list">
        <colgroup>
          <col style={{ width: "200px" }} />
          <col />
          <col style={{ width: "120px" }} />
          <col style={{ width: "40px" }} />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead align="right"> </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <Show
            when={filtered().length > 0}
            fallback={
              <TableRow>
                <TableCell class={styles.rosterEmpty} colspan={4}>
                  {filter()
                    ? "Ningún miembro coincide con tu búsqueda."
                    : "No hay miembros."}
                </TableCell>
              </TableRow>
            }
          >
            <For each={filtered()}>
              {(member) => {
                const status = statusBadge(member);
                const canOpen = () => !isSelf(member);
                return (
                  <TableRow
                    clickable={canOpen()}
                    tabindex={canOpen() ? 0 : undefined}
                    onClick={() => openMember(member)}
                    onKeyDown={(event) => {
                      if (
                        canOpen() &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        openMember(member);
                      }
                    }}
                  >
                    <TableCell>
                      <Avatar
                        class={styles.rosterAvatar}
                        imageUrl={member.avatarUrl}
                        fallback={getUserInitials(shortName(member))}
                      />
                      <OverflowingText text={shortName(member)} />
                    </TableCell>
                    <TableCell ellipsis>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell align="right" class={styles.rosterChevron}>
                      <Show when={!isSelf(member)}>
                        <ChevronRight size={16} />
                      </Show>
                    </TableCell>
                  </TableRow>
                );
              }}
            </For>
          </Show>
        </TableBody>
      </Table>
    </SettingsSection>
  );
}

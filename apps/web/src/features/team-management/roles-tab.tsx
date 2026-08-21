import { useNavigate } from "@solidjs/router";
import { createMemo, For } from "solid-js";

import ChevronRight from "~/components/icons/chevron-right";
import { SettingsSection } from "~/components/settings/SettingsSection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/layout/table";
import type { Role } from "~/domain/auth/access/rbac";
import { ROLES } from "~/domain/auth/access/rbac";
import { getRoleLabel } from "~/domain/auth/access/role-display";
import { membersRosterQuery } from "~/rpc/team-management/members-roster";

import styles from "./team-management.module.css";

export function RolesTab() {
  const navigate = useNavigate();
  const roster = createMemo(() => membersRosterQuery());

  const memberCountByRole = createMemo(() => {
    const counts = new Map<Role, number>();

    for (const member of roster()?.members ?? []) {
      counts.set(member.role, (counts.get(member.role) ?? 0) + 1);
    }

    return counts;
  });

  return (
    <SettingsSection
      title="Roles"
      description="Los roles determinan los permisos. Son fijos y se asignan a cada usuario desde su detalle."
    >
      <Table aria-label="Roles" variant="list">
        <colgroup>
          <col style={{ width: "260px" }} />
          <col />
          <col style={{ width: "40px" }} />
        </colgroup>

        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead align="right">Miembros</TableHead>
            <TableHead align="right"> </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <For each={ROLES}>
            {(role) => {
              const openRoleDetails = () =>
                navigate(`/settings/members/roles/${role}`);

              const memberCount = () => memberCountByRole().get(role) ?? 0;

              return (
                <TableRow
                  clickable
                  tabindex={0}
                  onClick={openRoleDetails}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openRoleDetails();
                    }
                  }}
                >
                  <TableCell>{getRoleLabel(role)}</TableCell>

                  <TableCell align="right" class={styles.roleCount}>
                    {memberCount()} miembro{memberCount() === 1 ? "" : "s"}
                  </TableCell>

                  <TableCell align="right" class={styles.rosterChevron}>
                    <ChevronRight size={16} />
                  </TableCell>
                </TableRow>
              );
            }}
          </For>
        </TableBody>
      </Table>
    </SettingsSection>
  );
}

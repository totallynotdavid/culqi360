import { useParams, useSearchParams } from "@solidjs/router";
import { createMemo, Match, Show, Switch } from "solid-js";

import Activity from "~/components/icons/activity";
import Info from "~/components/icons/info";
import ShieldCheck from "~/components/icons/shield-check";
import { getUserInitials } from "~/components/layout/account-menu-utils";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { Avatar } from "~/components/ui/display/avatar";
import { Badge } from "~/components/ui/display/badge";
import { hasPermission } from "~/domain/auth/access/rbac";
import {
  getRoleBadgeVariant,
  getRoleLabel,
} from "~/domain/auth/access/role-display";
import { shortName } from "~/domain/identity/display-name";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";
import {
  TabStrip,
  type TabItem,
} from "~/features/side-panel/components/tab-strip";
import { MemberAdminActions } from "~/features/team-management/member-admin-actions";
import { MemberCapacityTab } from "~/features/team-management/member-capacity-tab";
import { MemberInfoTab } from "~/features/team-management/member-info-tab";
import { MemberPermissionsTab } from "~/features/team-management/member-permissions-tab";
import { memberDetailQuery } from "~/rpc/team-management/member-detail";

import styles from "~/features/team-management/team-management.module.css";

type MemberTabId = "info" | "permissions" | "capacity";

export default function SettingsMemberDetailPage() {
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const { currentUser } = useAuthenticatedSession();
  const detail = createMemo(() => memberDetailQuery(params.userId));

  const tabs = createMemo<TabItem<MemberTabId>[]>(() => {
    const member = detail();
    const items: TabItem<MemberTabId>[] = [
      { id: "info", label: "Información", icon: Info },
      { id: "permissions", label: "Permisos", icon: ShieldCheck },
    ];

    if (
      member?.role === "executive" &&
      hasPermission(currentUser().role, "capacity:read:team")
    ) {
      items.push({
        id: "capacity",
        label: "Capacidad",
        icon: Activity,
      });
    }

    return items;
  });

  const activeTab = createMemo<MemberTabId>(() => {
    const requested = search.tab;
    const tab = tabs().find((item) => item.id === requested);

    return tab?.id ?? "info";
  });

  return (
    <SettingsPageLayout>
      <Show when={detail()}>
        {(member) => (
          // Remount when the member changes, but not on revalidation.
          <Show when={member().id} keyed>
            {(memberId) => (
              <>
                <header class={styles.detailHeader}>
                  <Avatar
                    class={styles.detailAvatar}
                    imageUrl={member().avatarUrl}
                    fallback={getUserInitials(shortName(member()))}
                  />

                  <div class={styles.detailHeaderText}>
                    <span class={styles.detailName}>{shortName(member())}</span>
                    <span class={styles.detailEmail}>{member().email}</span>

                    <div class={styles.headerBadges}>
                      <Badge variant={getRoleBadgeVariant(member().role)}>
                        {getRoleLabel(member().role)}
                      </Badge>

                      <Show
                        when={member().isActive}
                        fallback={<Badge variant="secondary">Inactivo</Badge>}
                      >
                        <Badge variant="success">Activo</Badge>
                      </Show>
                    </div>
                  </div>
                </header>

                <div class={styles.tabStrip}>
                  <TabStrip
                    tabs={tabs()}
                    activeTab={activeTab()}
                    onTabSelect={(id) => setSearch({ tab: id })}
                  />
                </div>

                <div class={styles.tabPane}>
                  <Switch>
                    <Match when={activeTab() === "info"}>
                      <MemberInfoTab detail={member()} />
                      <MemberAdminActions detail={member()} />
                    </Match>

                    <Match when={activeTab() === "permissions"}>
                      <MemberPermissionsTab detail={member()} />
                    </Match>

                    <Match when={activeTab() === "capacity"}>
                      <MemberCapacityTab userId={memberId} />
                    </Match>
                  </Switch>
                </div>
              </>
            )}
          </Show>
        )}
      </Show>
    </SettingsPageLayout>
  );
}

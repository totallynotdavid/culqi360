import { Title } from "@solidjs/meta";
import { useLocation } from "@solidjs/router";
import { Dynamic } from "@solidjs/web";
import { Show, createMemo } from "solid-js";

import { ICON_BY_ROUTE } from "~/components/layout/route-icons";
import { TintedIconTile } from "~/components/ui/display/tinted-icon-tile/tinted-icon-tile";
import { PageCardHeader } from "~/components/ui/layout/page-card/page-card-header";
import { getHeaderRoute } from "~/domain/navigation/policy";

import { AppHeaderActions } from "./app-header-actions";

export function AppHeader() {
  const location = useLocation();
  const currentRoute = createMemo(() => getHeaderRoute(location.pathname));

  return (
    <>
      <Title>{currentRoute().label}</Title>
      <PageCardHeader
        icon={
          <Show
            when={currentRoute().tileColor}
            fallback={
              <Dynamic
                component={ICON_BY_ROUTE[currentRoute().icon]}
                size={16}
              />
            }
          >
            {(tileColor) => (
              <TintedIconTile
                Icon={ICON_BY_ROUTE[currentRoute().icon]}
                color={tileColor()}
              />
            )}
          </Show>
        }
        title={currentRoute().label}
        actionButton={<AppHeaderActions />}
      />
    </>
  );
}

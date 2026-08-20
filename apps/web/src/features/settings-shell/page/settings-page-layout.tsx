import { useLocation } from "@solidjs/router";
import { type JSX } from "@solidjs/web";
import { createMemo, type ParentProps } from "solid-js";

import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import {
  getCurrentSettingsItem,
  getSettingsSectionHref,
  getSettingsSectionLabel,
} from "~/features/navigation-drawer/settings/settings-navigation.selectors";
import { SettingsPageContainer } from "~/features/settings-shell/content/settings-page-container";

import type { BreadcrumbItem, MobileBackAction } from "./breadcrumb-model";
import { SubMenuTopBarContainer } from "./sub-menu-top-bar-container";

interface SettingsPageLayoutProps extends ParentProps {
  actionButton?: JSX.Element;
}

export function SettingsPageLayout(props: SettingsPageLayoutProps) {
  const location = useLocation();
  const { currentUser } = useAuthenticatedSession();

  const role = createMemo(() => currentUser().role);

  const currentItem = createMemo(() =>
    getCurrentSettingsItem(location.pathname, role()),
  );

  const sectionHref = createMemo(() =>
    getSettingsSectionHref(currentItem().section, role()),
  );

  const breadcrumbItems = createMemo<BreadcrumbItem[]>(() => [
    {
      label: getSettingsSectionLabel(currentItem().section, role()),
      href: sectionHref(),
    },
    {
      label: currentItem().label,
    },
  ]);

  const mobileBackAction = createMemo<MobileBackAction>(() => {
    if (!sectionHref()) {
      return { kind: "none" };
    }

    return {
      kind: "open-settings-drawer",
      label: "Volver a ajustes",
    };
  });

  return (
    <SubMenuTopBarContainer
      breadcrumbItems={breadcrumbItems()}
      mobileBackAction={mobileBackAction()}
      title={currentItem().label}
      actionButton={props.actionButton}
    >
      <SettingsPageContainer>{props.children}</SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
}

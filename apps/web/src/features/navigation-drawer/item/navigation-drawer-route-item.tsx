import type { JSX } from "@solidjs/web";

import { WithTooltip } from "~/components/ui/overflow-tooltip/overflow-tooltip";

import {
  NavigationDrawerItemFrame,
  type NavigationDrawerItemFrameProps,
} from "./navigation-drawer-item-frame";

import tooltipStyles from "~/components/ui/overflow-tooltip/overflow-tooltip.module.css";

interface NavigationDrawerRouteItemProps extends Omit<
  NavigationDrawerItemFrameProps,
  "render"
> {
  href: string;
  unavailable: boolean;
  onClick: JSX.EventHandlerUnion<HTMLAnchorElement, MouseEvent>;
}

export function NavigationDrawerRouteItem(
  props: NavigationDrawerRouteItemProps,
) {
  return (
    <NavigationDrawerItemFrame
      class={props.class}
      label={props.label}
      secondaryLabel={props.secondaryLabel}
      indentationLevel={props.indentationLevel}
      subItemState={props.subItemState}
      Icon={props.Icon}
      tileColor={props.tileColor}
      active={props.active}
      modifier={props.modifier}
      rightOptions={props.rightOptions}
      alwaysShowRightOptions={props.alwaysShowRightOptions}
      showChevron={props.showChevron}
      chevronExpanded={props.chevronExpanded}
      variant={props.variant}
      collapsedMain={props.collapsedMain}
      isMobile={props.isMobile}
      render={(frame) => (
        <WithTooltip
          tooltip={frame.title() ?? ""}
          disabled={!frame.title()}
          position="right"
          class={tooltipStyles.wrapperFill}
        >
          <a
            href={props.href}
            class={frame.class()}
            onClick={props.onClick}
            draggable={false}
            aria-disabled={props.unavailable ? "true" : undefined}
            aria-current={props.active ? "page" : undefined}
            tabindex={props.unavailable ? "-1" : undefined}
            style={frame.style()}
          >
            {frame.content}
          </a>
        </WithTooltip>
      )}
    />
  );
}

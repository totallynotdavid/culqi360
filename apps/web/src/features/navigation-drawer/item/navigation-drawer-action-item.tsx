import type { JSX } from "@solidjs/web";

import { WithTooltip } from "~/components/ui/overflow-tooltip/overflow-tooltip";

import {
  NavigationDrawerItemFrame,
  type NavigationDrawerItemFrameProps,
} from "./navigation-drawer-item-frame";

import tooltipStyles from "~/components/ui/overflow-tooltip/overflow-tooltip.module.css";

interface NavigationDrawerActionItemProps extends Omit<
  NavigationDrawerItemFrameProps,
  "render"
> {
  unavailable: boolean;
  onClick: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
}

export function NavigationDrawerActionItem(
  props: NavigationDrawerActionItemProps,
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
          <button
            type="button"
            class={frame.class()}
            onClick={props.onClick}
            disabled={props.unavailable}
            aria-expanded={
              props.showChevron
                ? props.chevronExpanded
                  ? "true"
                  : "false"
                : undefined
            }
            style={frame.style()}
          >
            {frame.content}
          </button>
        </WithTooltip>
      )}
    />
  );
}

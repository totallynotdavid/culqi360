import type { JSX } from "@solidjs/web";

import type { TileColor } from "~/shared/ui/tile-color";

export type NavigationDrawerSubItemState =
  | "intermediate-before-selected"
  | "intermediate-selected"
  | "intermediate-after-selected"
  | "last-selected"
  | "last-not-selected";

export type NavigationDrawerItemModifier = "new" | "soon";

export type NavigationDrawerItemVariant = "default" | "tertiary";

export interface NavigationDrawerIconProps {
  class?: string;
  size?: number;
  strokeWidth?: number;
}

export type NavigationDrawerIcon = (
  props: NavigationDrawerIconProps,
) => JSX.Element;

export interface NavigationDrawerItemProps {
  class?: string;
  label: string;
  secondaryLabel?: string;
  indentationLevel?: 1 | 2;
  subItemState?: NavigationDrawerSubItemState;
  to?: string;
  onClick?: () => void;
  Icon?: NavigationDrawerIcon;
  tileColor?: TileColor;
  active?: boolean;
  modifier?: NavigationDrawerItemModifier;
  rightOptions?: JSX.Element;
  alwaysShowRightOptions?: boolean;
  closeOnNavigate?: () => void;
  showChevron?: boolean;
  chevronExpanded?: boolean;
  preventCollapseOnMobile?: boolean;
  variant?: NavigationDrawerItemVariant;
}

export interface NavigationDrawerItemFrameBaseProps {
  class?: string;
  label: string;
  secondaryLabel?: string;
  indentationLevel: 1 | 2;
  subItemState?: NavigationDrawerSubItemState;
  Icon?: NavigationDrawerIcon;
  tileColor?: TileColor;
  active?: boolean;
  modifier?: NavigationDrawerItemModifier;
  rightOptions?: JSX.Element;
  alwaysShowRightOptions?: boolean;
  showChevron?: boolean;
  chevronExpanded?: boolean;
  variant?: NavigationDrawerItemVariant;
  collapsedMain: boolean;
  isMobile: boolean;
}

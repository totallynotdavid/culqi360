import type { JSX } from "@solidjs/web";

export type SettingsNavSectionId =
  | "account"
  | "operations"
  | "administration"
  | "other";

export interface SettingsNavItem {
  id: string;
  label: string;
  href?: string;
  icon: (props: { class?: string; size?: number }) => JSX.Element;
  section: SettingsNavSectionId;
  onClick?: () => void | Promise<void>;
  indentationLevel?: 1 | 2;
  matchSubPages?: boolean;
  isHidden?: boolean;
  subItems?: SettingsNavItem[];
  isAdvanced?: boolean;
  modifier?: "new" | "soon";
}

export interface SettingsNavSection {
  id: SettingsNavSectionId;
  label: string;
  items: SettingsNavItem[];
  /** Marks the whole section (its title, not just individual items) as advanced-mode-only. */
  isAdvanced?: boolean;
}

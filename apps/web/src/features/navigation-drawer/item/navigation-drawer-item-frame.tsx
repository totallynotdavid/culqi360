import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { children, type Accessor } from "solid-js";

import ChevronRight from "~/components/icons/chevron-right";
import { TintedIconTile } from "~/components/ui/display/tinted-icon-tile/tinted-icon-tile";

import { NavigationDrawerAnimatedCollapseWrapper } from "./navigation-drawer-animated-collapse-wrapper";
import { NavigationDrawerItemBreadcrumb } from "./navigation-drawer-item-breadcrumb";
import type { NavigationDrawerItemFrameBaseProps } from "./navigation-drawer-item.types";

import styles from "./navigation-drawer-item.module.css";

export interface NavigationDrawerItemFrameRenderProps {
  class: Accessor<string>;
  content: JSX.Element;
  style: Accessor<JSX.CSSProperties>;
  title: Accessor<string | undefined>;
}

export interface NavigationDrawerItemFrameProps extends NavigationDrawerItemFrameBaseProps {
  render: (props: NavigationDrawerItemFrameRenderProps) => JSX.Element;
}

export function NavigationDrawerItemFrame(
  props: NavigationDrawerItemFrameProps,
) {
  const rightOptions = children(() => props.rightOptions);

  const isSoon = () => props.modifier === "soon";
  const isNew = () => props.modifier === "new";
  const showBreadcrumb = () => props.indentationLevel === 2;

  const hasRightOptions = () =>
    Boolean(rightOptions()) || Boolean(props.showChevron);

  const shouldShowRightOptions = () =>
    props.isMobile || Boolean(props.alwaysShowRightOptions);

  const className = () =>
    clsx(
      "navigation-drawer-item",
      styles.item,
      props.class,
      props.active && styles.itemActive,
      showBreadcrumb() && styles.itemIndented,
      props.variant === "tertiary" && styles.itemTertiary,
      isSoon() && styles.itemSoon,
    );

  const content = (
    <div class={styles.itemElements}>
      {showBreadcrumb() ? (
        <NavigationDrawerAnimatedCollapseWrapper>
          <NavigationDrawerItemBreadcrumb state={props.subItemState} />
        </NavigationDrawerAnimatedCollapseWrapper>
      ) : null}

      {props.Icon ? (
        <span class={styles.iconWrap}>
          {props.tileColor ? (
            <TintedIconTile Icon={props.Icon} color={props.tileColor} />
          ) : (
            <props.Icon size={16} />
          )}
        </span>
      ) : null}

      <span
        class={clsx(
          styles.itemLabelParent,
          props.collapsedMain && styles.itemLabelCollapsed,
        )}
      >
        <span class={styles.itemLabel}>{props.label}</span>

        {props.secondaryLabel ? (
          <span class={styles.itemSecondaryLabel}>
            {` · ${props.secondaryLabel}`}
          </span>
        ) : null}
      </span>

      {isSoon() ? (
        <NavigationDrawerAnimatedCollapseWrapper>
          <span class={styles.itemPill}>Próximamente</span>
        </NavigationDrawerAnimatedCollapseWrapper>
      ) : null}

      {isNew() ? (
        <NavigationDrawerAnimatedCollapseWrapper>
          <span class={styles.itemPill}>Nuevo</span>
        </NavigationDrawerAnimatedCollapseWrapper>
      ) : null}

      {hasRightOptions() ? (
        <NavigationDrawerAnimatedCollapseWrapper>
          <span class={styles.itemRight}>
            <span
              class={styles.itemRightVisibility}
              data-visible={shouldShowRightOptions() ? "true" : undefined}
            >
              {props.showChevron ? (
                <span class={styles.itemChevron}>
                  <ChevronRight
                    size={12}
                    style={{
                      transform: props.chevronExpanded
                        ? "rotate(90deg)"
                        : "rotate(0deg)",
                    }}
                  />
                </span>
              ) : (
                rightOptions()
              )}
            </span>
          </span>
        </NavigationDrawerAnimatedCollapseWrapper>
      ) : null}
    </div>
  );

  const style = () =>
    ({
      "--item-width-base": props.collapsedMain
        ? "var(--nav-drawer-collapsed-width)"
        : "100%",
      "--item-width-offset": props.collapsedMain ? "var(--spacing-6)" : "6px",
      "--item-padding-right": hasRightOptions() ? "2px" : "var(--spacing-1)",
      cursor: isSoon() ? "default" : "pointer",
      "pointer-events": isSoon() ? "none" : "auto",
    }) satisfies JSX.CSSProperties;

  const title = () => (props.collapsedMain ? props.label : undefined);

  return props.render({
    class: className,
    content,
    style,
    title,
  });
}

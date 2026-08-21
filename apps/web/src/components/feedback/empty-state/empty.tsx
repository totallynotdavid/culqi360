import type { JSX } from "@solidjs/web";
import type { Component } from "solid-js";

import type { IconProps } from "~/components/icons/icon-base";
import Inbox from "~/components/icons/inbox";

import styles from "./empty.module.css";

type IconComponent = Component<Omit<IconProps, "name" | "iconNode">>;

interface EmptyStateProps {
  icon?: IconComponent;
  title: string;
  description?: string;
  action?: JSX.Element;
}

export function EmptyState(props: EmptyStateProps) {
  const Icon = () => props.icon ?? Inbox;
  return (
    <div class={styles.root}>
      <div class={styles.iconWrap}>
        {(() => {
          const I = Icon();
          return <I size={20} />;
        })()}
      </div>
      <h3 class={styles.title}>{props.title}</h3>
      {props.description && (
        <p class={styles.description}>{props.description}</p>
      )}
      {props.action}
    </div>
  );
}

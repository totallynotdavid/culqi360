import { useNavigate } from "@solidjs/router";
import { clsx } from "clsx";
import { Show, createSignal } from "solid-js";

import ChevronDown from "~/components/icons/chevron-down";
import LogOut from "~/components/icons/log-out";
import Moon from "~/components/icons/moon";
import Sun from "~/components/icons/sun";
import UserRound from "~/components/icons/user-round";
import { getUserInitials } from "~/components/layout/account-menu-utils";
import { Avatar } from "~/components/ui/display/avatar";
import { useTheme } from "~/components/ui/theme/theme-context";
import { useDismissibleLayer } from "~/components/ui/utilities/use-dismissible-layer";

import styles from "./account-menu.module.css";

interface AccountMenuProps {
  label: string;
  avatarUrl?: string | null;
  collapsed?: boolean;
  onOpenSettings?: () => void;
  onLogout: () => Promise<void>;
}

export function AccountMenu(props: AccountMenuProps) {
  const [open, setOpen] = createSignal(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  let containerRef: HTMLDivElement | undefined;

  useDismissibleLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    getContainer: () => containerRef,
  });

  return (
    <div
      ref={(element) => {
        containerRef = element;
      }}
      class={styles.container}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open() ? "true" : "false"}
        onClick={() => setOpen((prev) => !prev)}
        class={clsx(styles.trigger, props.collapsed && styles.triggerCollapsed)}
      >
        <Avatar
          imageUrl={props.avatarUrl ?? null}
          fallback={getUserInitials(props.label)}
          class={styles.avatar}
          fallbackClass={styles.avatarFallback}
        />
        <Show when={!props.collapsed}>
          <span class={styles.label}>{props.label}</span>
        </Show>
        <Show when={!props.collapsed}>
          <ChevronDown
            class={clsx(styles.chevron, open() && styles.chevronOpen)}
            size={16}
          />
        </Show>
      </button>

      <Show when={open()}>
        <div class={styles.menu}>
          <button
            type="button"
            onClick={() => {
              props.onOpenSettings?.();
              setOpen(false);
              navigate("/settings/profile");
            }}
            class={styles.item}
          >
            <UserRound size={16} />
            Mi perfil
          </button>
          <button
            type="button"
            onClick={() => {
              toggleTheme();
              setOpen(false);
            }}
            class={styles.item}
          >
            {theme() === "light" ? <Moon size={16} /> : <Sun size={16} />}
            Tema {theme() === "light" ? "oscuro" : "claro"}
          </button>
          <hr class={styles.separator} />
          <button
            type="button"
            class={clsx(styles.item, styles.danger)}
            onClick={() => {
              setOpen(false);
              void props
                .onLogout()
                .then(() => navigate("/login", { replace: true }))
                .catch(() => undefined);
            }}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </Show>
    </div>
  );
}

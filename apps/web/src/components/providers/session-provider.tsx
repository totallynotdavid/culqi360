import { revalidate } from "@solidjs/router";
import {
  createContext,
  createOptimistic,
  type ParentProps,
  useContext,
} from "solid-js";

import type { CurrentUserView } from "~/contracts/auth";
import { meQuery } from "~/rpc/auth/me";

interface SessionContextValue {
  /** `null` means signed out. There is no "not loaded yet" value: an
   * unsettled read suspends to the nearest `Loading` boundary instead. */
  user: () => CurrentUserView | null;
  updateCurrentUser: (
    update: (current: CurrentUserView) => CurrentUserView,
  ) => void;
  /** Marks the session query stale. `user` picks up the refetch on its own. */
  refreshCurrentUser: () => void;
}

const SessionContext = createContext<SessionContextValue>();

export function SessionProvider(props: ParentProps) {
  // A write here is visible for the lifetime of the surrounding action and
  // reverts to the query's value when it settles, or rolls back if it throws.
  const [user, setUser] = createOptimistic(() => meQuery());

  const updateCurrentUser = (
    update: (current: CurrentUserView) => CurrentUserView,
  ) => {
    const current = user();

    if (!current) {
      return;
    }

    setUser(update(current));
  };

  return (
    <SessionContext
      value={{
        user,
        updateCurrentUser,
        refreshCurrentUser: () => revalidate(meQuery.key),
      }}
    >
      {props.children}
    </SessionContext>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return context;
}

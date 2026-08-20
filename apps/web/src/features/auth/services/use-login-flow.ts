import { createSignal, onSettled } from "solid-js";

type AuthMethod = "google" | "password" | "passkey";

const LAST_USED_KEY = "last_auth_method";

function readLastUsed(): AuthMethod | null {
  try {
    const value = localStorage.getItem(LAST_USED_KEY);

    if (value === "google" || value === "password" || value === "passkey") {
      return value;
    }
  } catch {
    // localStorage throws in SSR and sandboxed contexts
  }

  return null;
}

function persistLastUsed(method: AuthMethod): void {
  try {
    localStorage.setItem(LAST_USED_KEY, method);
  } catch {
    // localStorage throws in SSR and sandboxed contexts
  }
}

export function useLoginFlow() {
  const [lastUsedMethod, setLastUsedMethod] = createSignal<AuthMethod | null>(
    null,
  );

  onSettled(() => {
    setLastUsedMethod(readLastUsed());
  });

  function markUsed(method: AuthMethod): void {
    persistLastUsed(method);
    setLastUsedMethod(method);
  }

  return {
    lastUsedMethod,
    markUsed,
  };
}

import type { SessionRecord } from "@/src/domain/model";

const SESSION_KEY = "crm_extension_session_v2" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function parseSession(value: unknown): SessionRecord | null {
  if (
    !isRecord(value) ||
    typeof value.installationId !== "string" ||
    typeof value.origin !== "string"
  ) {
    return null;
  }
  return {
    installationId: value.installationId,
    origin: value.origin,
    sessionToken: nullableString(value.sessionToken),
    refreshToken: nullableString(value.refreshToken),
  };
}

/** The installation session is the only state kept in `storage.local`. */
export async function readSession(): Promise<SessionRecord | null> {
  const stored = await browser.storage.local.get(SESSION_KEY);
  return parseSession(stored[SESSION_KEY]);
}

export async function writeSession(session: SessionRecord): Promise<void> {
  await browser.storage.local.set({ [SESSION_KEY]: session });
}

export async function clearCredentials(): Promise<void> {
  const session = await readSession();
  if (!session) {
    return;
  }
  await writeSession({ ...session, sessionToken: null, refreshToken: null });
}

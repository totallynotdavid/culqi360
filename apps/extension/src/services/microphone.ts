/** The reason a recording fails, and the side panel shows, without the grant. */
export const MICROPHONE_NOT_ALLOWED = "microphone not allowed";

/**
 * An offscreen document cannot ask for the microphone: Chrome refuses at once
 * with `NotAllowedError`. A visible extension page can ask, and once the
 * extension origin holds the grant the offscreen document opens the microphone
 * with no page. That is why the prompt lives in `permission.html`.
 */
export async function openMicrophone(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new Error(MICROPHONE_NOT_ALLOWED, { cause: error });
    }
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(`microphone unavailable: ${reason}`, { cause: error });
  }
}

export function microphonePermission(): Promise<PermissionStatus> {
  return navigator.permissions.query({ name: "microphone" });
}

export async function openPermissionPage(): Promise<void> {
  await chrome.tabs.create({ url: chrome.runtime.getURL("permission.html") });
}

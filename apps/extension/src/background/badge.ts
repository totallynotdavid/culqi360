import { readState } from "./state";

const NEEDS_CAPTURE_BADGE = "!";
const NEEDS_CAPTURE_COLOR = "#d97706";

/**
 * Marks the toolbar icon while a call is live and nothing records it. Starting
 * a capture needs a click on the extension icon (or the shortcut) on the call
 * tab, so the badge is the only prompt an agent sees with the dashboard closed.
 */
export async function syncBadge(): Promise<void> {
  const { recording } = await readState();
  await chrome.action.setBadgeBackgroundColor({ color: NEEDS_CAPTURE_COLOR });
  await chrome.action.setBadgeText({
    text: recording.startable ? NEEDS_CAPTURE_BADGE : "",
  });
}

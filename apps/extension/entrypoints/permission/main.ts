import { openMicrophone } from "@/src/services/microphone";

const status = document.getElementById("status");

function show(text: string): void {
  if (status) {
    status.textContent = text;
  }
}

async function closeThisTab(): Promise<void> {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id !== undefined) {
    await chrome.tabs.remove(tab.id);
  }
}

/**
 * The only job of this page is to be a visible extension page that asks once.
 * After the grant the offscreen document opens the microphone on its own.
 */
async function requestMicrophone(): Promise<void> {
  try {
    const microphone = await openMicrophone();
    for (const track of microphone.getTracks()) {
      track.stop();
    }
  } catch (error: unknown) {
    show(
      `${error instanceof Error ? error.message : "microphone failed"}. Allow the microphone for this extension in the browser's site settings, then reload this page.`,
    );
    return;
  }

  show("Microphone allowed. You can close this tab.");
  await closeThisTab().catch((error: unknown) =>
    console.error("permission tab was not closed", error),
  );
}

void requestMicrophone();

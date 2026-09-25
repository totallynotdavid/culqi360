import Plus from "~/components/icons/plus";
import { useSidePanel } from "~/features/side-panel/state/use-side-panel";
import { createLeadRecordCreateSidePanelPage } from "~/features/side-panel/types/side-panel-page";

export function useCreateLeadRecordAction(options?: {
  /**
   * Resolves to the message explaining why registration is capped, or null when
   * it is allowed. Checked on click rather than prefetched into the reactive
   * graph: the cap is server state that only matters at the moment of the
   * click, and the underlying query is cached, so a repeat click costs nothing.
   */
  blockedReason: () => Promise<string | null>;
  onBlocked: (reason: string) => void;
}) {
  const { openPanel } = useSidePanel();

  async function open(): Promise<void> {
    // Show the registration cap before opening a form that would reject it.
    const reason = await options?.blockedReason();

    if (reason) {
      options?.onBlocked(reason);
      return;
    }

    openPanel(createLeadRecordCreateSidePanelPage());
  }

  return {
    label: "Añadir nuevo",
    emptyLabel: "Añadir un cliente",
    inlineLabel: "Añadir nuevo",
    icon: Plus,
    onClick: () => void open(),
  };
}

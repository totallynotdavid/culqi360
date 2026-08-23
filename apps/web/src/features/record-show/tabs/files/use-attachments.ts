import { revalidate } from "@solidjs/router";
import { createMemo } from "solid-js";
import type { Accessor } from "solid-js";

import { leadSaleProofFilesQuery } from "~/rpc/workflow/lead-sale-proof-files";

export function useAttachments(leadId: Accessor<string | null>) {
  const attachments = createMemo(async () => {
    const id = leadId();
    if (!id) {
      return [];
    }

    return leadSaleProofFilesQuery(id);
  });

  return {
    attachments,
    refetch: () => {
      const id = leadId();
      if (!id) {
        return;
      }

      revalidate(leadSaleProofFilesQuery.keyFor(id));
    },
  };
}

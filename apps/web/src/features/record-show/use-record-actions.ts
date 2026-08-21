import { useAction } from "@solidjs/router";
import { createSignal } from "solid-js";

import type { LeadDetailLeadView } from "~/contracts/workflow/views";
import {
  addLeadToFavoritesMutation,
  deleteLeadMutation,
  removeLeadFromFavoritesMutation,
} from "~/features/workflow/data/command-mutations";
import {
  revalidateWorkflowLead,
  revalidateWorkflowLeadList,
} from "~/features/workflow/data/revalidate-workflow";

function exportLeadAsJson(lead: LeadDetailLeadView) {
  const payload = {
    empresa: lead,
    exportadoEn: new Date().toISOString(), // clock-boundary: export requested
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `empresa-${lead.id}.json`;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function useLeadActions() {
  const addFavorite = useAction(addLeadToFavoritesMutation);
  const removeFavorite = useAction(removeLeadFromFavoritesMutation);
  const deleteLeadAction = useAction(deleteLeadMutation);

  const [favoriteBusy, setFavoriteBusy] = createSignal(false);
  const [deleteBusy, setDeleteBusy] = createSignal(false);

  async function deleteLead(leadId: string): Promise<void> {
    if (deleteBusy()) {
      return;
    }

    setDeleteBusy(true);

    try {
      await deleteLeadAction({ leadId });
      revalidateWorkflowLeadList();
    } finally {
      setDeleteBusy(false);
    }
  }

  async function setFavorite(
    leadId: string,
    isFavorite: boolean,
  ): Promise<{ message: string } | undefined> {
    if (favoriteBusy()) {
      return undefined;
    }

    setFavoriteBusy(true);

    try {
      const result = isFavorite
        ? await removeFavorite({ leadId })
        : await addFavorite({ leadId });

      revalidateWorkflowLead(leadId);

      return result;
    } finally {
      setFavoriteBusy(false);
    }
  }

  return {
    favoriteBusy,
    setFavorite,
    deleteBusy,
    deleteLead,
    exportLead: exportLeadAsJson,
  };
}

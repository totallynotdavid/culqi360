import { useAction } from "@solidjs/router";

import { UserPicker } from "~/components/ui/pickers/user-picker";
import { actionErrorMessage } from "~/contracts/errors";
import { assignableExecutivesQuery } from "~/rpc/workflow/assignable-executives";

import { reassignLeadMutation } from "../../data/command-mutations";
import {
  revalidateWorkflowLead,
  revalidateWorkflowLeadList,
} from "../../data/revalidate-workflow";

export interface ExecutivePickerProps {
  leadId: string;
  currentUserId: string;
  onSelect: () => void;
  onClose: () => void;
}

export function ExecutivePicker(props: ExecutivePickerProps) {
  const reassign = useAction(reassignLeadMutation);

  async function handleSelect(executiveId: string) {
    try {
      await reassign({ leadId: props.leadId, newExecutiveId: executiveId });
      // Reassigning changes ownership, which affects "mine" list filters, so the
      // list view must refresh too, not only the open record.
      revalidateWorkflowLead(props.leadId);
      revalidateWorkflowLeadList();
      props.onSelect();
    } catch (caught) {
      throw new Error(actionErrorMessage(caught), {
        cause: caught,
      });
    }
  }

  return (
    <UserPicker
      currentUserId={props.currentUserId}
      fetchUsers={(search) =>
        assignableExecutivesQuery({ leadId: props.leadId, search, limit: 50 })
      }
      onSelect={handleSelect}
      onClose={props.onClose}
    />
  );
}

import type { ContactAssignmentCallOutcome } from "~/contracts/contact-assignments/vocabulary";
import type {
  BranchId,
  ContactAssignmentId,
  OrganizationPersonId,
  UserId,
} from "~/domain/ids";

export interface AssignContactsCommand {
  actorUserId: UserId;
  branchId: BranchId;
}

export interface AssignContactsResult {
  requested: number;
  assigned: number;
}

export type CompleteContactAssignmentCallCommand = {
  actorUserId: UserId;
  assignmentId: ContactAssignmentId;
  contactId: OrganizationPersonId;
  outcome: ContactAssignmentCallOutcome;
  notes: string | null;
};

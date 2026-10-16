import { query } from "@solidjs/router";

import { getMyContactAssignments } from "~/server/contact-assignments/ui/queries";

export const myContactAssignmentsQuery = query(async () => {
  "use server";
  return getMyContactAssignments();
}, "contact-assignments.mine");

import { Loading } from "solid-js";

import { BulkImportSection } from "./bulk-import-section";
import { TeamInviteManagementSection } from "./team-invite-management-section";

export function InviteTab() {
  return (
    <Loading>
      <TeamInviteManagementSection />
      <BulkImportSection />
    </Loading>
  );
}

import type { MemberDetail } from "~/contracts/members";
import type { CalendarDate } from "~/domain/time/calendar-date";

export type MemberLoginBlock = "expired" | "inactive";

// Expiry wins over inactivity: the expiry sweep deactivates accounts, so an
// expired member is usually both, and reactivation alone does not help while
// expiresOn stays in the past.
export function memberLoginBlock(
  detail: Pick<MemberDetail, "isActive" | "expiresOn">,
  today: CalendarDate,
): MemberLoginBlock | null {
  if (detail.expiresOn !== null && detail.expiresOn < today) {
    return "expired";
  }

  return detail.isActive ? null : "inactive";
}

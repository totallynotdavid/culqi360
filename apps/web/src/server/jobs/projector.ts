import type { JobEvent, JobKind } from "~/contracts/jobs/job-event";
import type { AuthSession } from "~/domain/auth/access/session-types";

/**
 * How one kind of job answers "what is the current state of this subject".
 *
 * The registered form takes a raw string because the channel routes before it
 * knows the kind. Branded ids stay inside `defineJobProjector`, which is the
 * only place both halves are in scope at once.
 */
export interface JobProjector {
  kind: JobKind;

  // Returning null hides whether the subject is missing or merely inaccessible.
  open: (session: AuthSession, subjectId: string) => Promise<JobEvent | null>;
}

export function defineJobProjector<Id extends string, Detail>(config: {
  kind: JobKind;
  parseSubjectId: (raw: string) => Id | null;

  // Authorizes the subscription and returns its current state in one read.
  read: (
    session: AuthSession,
    subjectId: Id,
  ) => Promise<JobEvent<Detail> | null>;
}): JobProjector {
  return {
    kind: config.kind,

    open: async (session, rawSubjectId) => {
      const subjectId = config.parseSubjectId(rawSubjectId);

      return subjectId === null ? null : config.read(session, subjectId);
    },
  };
}

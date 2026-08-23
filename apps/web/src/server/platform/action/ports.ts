import type { DomainError } from "~/domain/errors";
import type { RecordActionObservationInput } from "~/server/observability/service";

export type ServerFunctionPorts = {
  record: (row: RecordActionObservationInput) => void;
  report: (error: DomainError) => void;
  setRetryAfterHeader: (retryAfterSeconds: number) => void;
};

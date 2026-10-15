import type { OperationContext } from "~/server/platform/operation/context";

import {
  ingestRuntimeEvent,
  listTeamExecutiveStatuses,
} from "./service/events";
import {
  claimInstallationSession,
  createHandoffToken,
} from "./service/handoff";
import {
  closeRecording,
  createRecording,
  putSegment,
  sweepIdleRecordings,
} from "./service/recordings";
import { refreshInstallationSession } from "./service/session";
import type { ExtensionRepos, ExtensionServiceDeps } from "./service/shared";

type CreateHandoffTokenInput = Parameters<typeof createHandoffToken>[1];
type ClaimInstallationSessionInput = Parameters<
  typeof claimInstallationSession
>[1];
type RefreshInstallationSessionInput = Parameters<
  typeof refreshInstallationSession
>[1];
type IngestRuntimeEventInput = Parameters<typeof ingestRuntimeEvent>[1];
type CreateRecordingInput = Parameters<typeof createRecording>[1];
type PutSegmentInput = Parameters<typeof putSegment>[1];
type CloseRecordingInput = Parameters<typeof closeRecording>[1];
type ListTeamExecutiveStatusesInput = Parameters<
  typeof listTeamExecutiveStatuses
>[1];

export function createExtensionService(
  repos: ExtensionRepos,
  deps: ExtensionServiceDeps,
) {
  const uow = deps.uow;

  return {
    createHandoffToken: (
      input: CreateHandoffTokenInput,
      operation: OperationContext,
    ) =>
      createHandoffToken(
        {
          repos,
          uow,
          operationAt: operation.operationAt,
        },
        input,
      ),

    claimInstallationSession: (
      input: ClaimInstallationSessionInput,
      operation: OperationContext,
    ) =>
      claimInstallationSession(
        {
          repos,
          uow,
          operationAt: operation.operationAt,
        },
        input,
      ),

    refreshInstallationSession: (
      input: RefreshInstallationSessionInput,
      operation: OperationContext,
    ) =>
      refreshInstallationSession(
        {
          repos,
          operationAt: operation.operationAt,
        },
        input,
      ),

    ingestRuntimeEvent: (
      input: IngestRuntimeEventInput,
      operation: OperationContext,
    ) =>
      ingestRuntimeEvent(
        {
          repos,
          uow,
          operationAt: operation.operationAt,
        },
        input,
      ),

    createRecording: (
      input: CreateRecordingInput,
      operation: OperationContext,
    ) => createRecording({ repos, operationAt: operation.operationAt }, input),

    putSegment: (input: PutSegmentInput, operation: OperationContext) =>
      putSegment(
        {
          repos,
          uow,
          storage: deps.storage,
          operationAt: operation.operationAt,
        },
        input,
      ),

    closeRecording: (input: CloseRecordingInput, operation: OperationContext) =>
      closeRecording({ repos, uow, operationAt: operation.operationAt }, input),

    sweepIdleRecordings: (operation: OperationContext) =>
      sweepIdleRecordings({ uow, operationAt: operation.operationAt }),

    listTeamExecutiveStatuses: (
      input: ListTeamExecutiveStatusesInput,
      operation: OperationContext,
    ) =>
      listTeamExecutiveStatuses(
        {
          repos,
          operationAt: operation.operationAt,
        },
        input,
      ),
  };
}

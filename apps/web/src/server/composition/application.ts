import { createAuditActionPoliciesRepo } from "~/server/audit-reader/audit-policy-repo";
import { createAuditPolicyService } from "~/server/audit-reader/policy-service";
import { createAuthRuntime } from "~/server/auth/runtime";
import { createCapacityRuntime } from "~/server/capacity/runtime";
import { createEnrichmentProjector } from "~/server/client-search/realtime";
import { createSharedRuntime } from "~/server/composition/shared-runtime";
import { createContactAssignmentsRuntime } from "~/server/contact-assignments/runtime";
import { createIngestJobBridge } from "~/server/data-source-uploads/job-bridge";
import { createIngestJobProjector } from "~/server/data-source-uploads/realtime";
import { createDataSourceUploadsRuntime } from "~/server/data-source-uploads/runtime";
import { createEventLogsChannel } from "~/server/event-logs/realtime";
import { createEventLogsService } from "~/server/event-logs/service";
import { createExtensionRuntime } from "~/server/extension/runtime";
import { createJobsChannel } from "~/server/jobs/channel";
import { createGpvSnapshotProjector } from "~/server/merchant-stats/snapshot/realtime";
import { createActionObservationsRepo } from "~/server/observability/repos-action-observations";
import { createAuthFunnelEventsRepo } from "~/server/observability/repos-auth-funnel-events";
import { createObservabilityService } from "~/server/observability/service";
import { uploadsConfig } from "~/server/platform/config/env";
import { dbUrl } from "~/server/platform/database/db";
import {
  serverInfrastructure,
  type ServerInfrastructure,
} from "~/server/platform/infrastructure";
import { createRealtimeService } from "~/server/realtime/runtime";
import { createRecordImportProjector } from "~/server/records/imports/realtime";
import { createSearchRuntime } from "~/server/search/runtime";
import { createRequestSessionsRepo } from "~/server/security/repos-request-sessions";
import { createTeamRuntime } from "~/server/team/runtime";
import { createUsersRuntime } from "~/server/users/runtime";
import { createWorkflowRuntime } from "~/server/workflow/runtime";

function createApplication(infrastructure: ServerInfrastructure) {
  const db = infrastructure.db;
  const shared = createSharedRuntime(infrastructure);

  const observability = createObservabilityService({
    actionObservations: createActionObservationsRepo(db),
    authFunnelEvents: createAuthFunnelEventsRepo(db),
  });

  const eventLogs = createEventLogsService(db);

  const auth = createAuthRuntime(
    infrastructure,
    shared.notifications,
    observability,
  );

  const users = createUsersRuntime(infrastructure, uploadsConfig());

  const dataSourceUploads = createDataSourceUploadsRuntime(shared.engine);
  const ingestBridge = createIngestJobBridge({
    db,
    getJob: dataSourceUploads.getJob,
  });

  const realtime = createRealtimeService({
    channels: [
      createEventLogsChannel(eventLogs),
      createJobsChannel([
        createGpvSnapshotProjector(shared.merchantStats),
        createRecordImportProjector(shared.recordImports),
        createIngestJobProjector(dataSourceUploads),
        createEnrichmentProjector(shared.clientSearch),
      ]),
    ],
    databaseUrl: dbUrl,
  });

  return {
    admin: createAuditPolicyService({
      auditActionPolicies: createAuditActionPoliciesRepo(db),
    }),
    auth,
    capacity: createCapacityRuntime(infrastructure),
    clientSearch: shared.clientSearch,
    contactAssignments: createContactAssignmentsRuntime({
      executor: db,
      engine: shared.engine,
    }),
    dataSourceUploads,
    ingestJobs: ingestBridge,
    eventLogs,
    extension: createExtensionRuntime(infrastructure),
    files: {
      download: shared.files.download,
    },
    http: {
      requestContext: {
        resolveAuthSession: auth.sessions.resolve,
        requestSessions: createRequestSessionsRepo(db),
      },
    },
    integration: {
      records: shared.recordImports,
    },
    maintenance: shared.maintenance,
    merchantStats: shared.merchantStats,
    notifications: shared.notifications,
    observability,
    realtime,
    search: createSearchRuntime(infrastructure, shared.engine),
    team: createTeamRuntime(
      infrastructure,
      shared.applicationConfig.publicOrigin,
      shared.notifications.messaging,
    ),
    users,
    workflow: createWorkflowRuntime(
      infrastructure,
      shared.files,
      shared.organizationEnrichment,
      {
        enqueueRucVerification: async (ruc, requestedByUserId, operation) => {
          await shared.clientSearch.requestEnrichment(
            { kind: "ruc", value: ruc },
            requestedByUserId,
            operation,
          );
        },
      },
    ),
  };
}

type Application = ReturnType<typeof createApplication>;

let application: Application | undefined;

// Build lazily so importing server modules does not require full runtime config.
export function getApplication(): Application {
  application ??= createApplication(serverInfrastructure);

  return application;
}

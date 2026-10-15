import { createAccessSecurityContext } from "~/server/auth/infrastructure/session-revocation-context";
import { runSessionCleanupTick } from "~/server/auth/session/cleanup";
import { createClientSearchRuntime } from "~/server/client-search/runtime";
import { createExtensionRuntime } from "~/server/extension/runtime";
import { createFilesRuntime } from "~/server/files/runtime";
import { createDefaultEngineClient } from "~/server/integrations/engine/client";
import { createIntegrationRuntime } from "~/server/integrations/infrastructure/runtime";
import { createMerchantStatsRuntime } from "~/server/merchant-stats/infrastructure/runtime";
import { createNotificationsRuntime } from "~/server/notifications/runtime";
import { createOrganizationEnrichmentProjection } from "~/server/organization/apply-enrichment";
import { createOrganizationEnrichment } from "~/server/organization/enrichment";
import { createOrganizationRepo } from "~/server/organization/organization-repo";
import {
  appConfig,
  engineConfig,
  notificationsConfig,
  uploadsConfig,
} from "~/server/platform/config/env";
import type { ServerInfrastructure } from "~/server/platform/infrastructure";
import type { OperationContext } from "~/server/platform/operation/context";
import { createRecordImportsRuntime } from "~/server/records/imports/runtime";
import { createAccountLifecycleMaintenance } from "~/server/users/account-lifecycle-maintenance";
import { createLeadReservationMaintenance } from "~/server/workflow/maintenance/lead-reservation-maintenance";

// Shared by the web process and maintenance worker. Request-scoped services
// belong in application.ts.
export function createSharedRuntime(infrastructure: ServerInfrastructure) {
  const applicationConfig = appConfig();
  const files = createFilesRuntime(infrastructure, uploadsConfig());
  const extension = createExtensionRuntime(infrastructure, files.storage);
  const notifications = createNotificationsRuntime(
    infrastructure,
    notificationsConfig(),
    applicationConfig,
  );
  const engine = createDefaultEngineClient(engineConfig());

  const organizationEnrichment = createOrganizationEnrichment(engine);
  const projectOrganization = createOrganizationEnrichmentProjection(
    createOrganizationRepo(infrastructure.db),
  );

  const clientSearch = createClientSearchRuntime(infrastructure, {
    fallbackOrganizationEnrichment: (ruc) =>
      organizationEnrichment.enrichByRuc(ruc),
    projectOrganization,
  });

  const integrations = createIntegrationRuntime({
    executor: infrastructure.db,
  });

  const recordImports = createRecordImportsRuntime(integrations, files.storage);

  const merchantStats = createMerchantStatsRuntime({
    db: infrastructure.db,
    files,
  });

  const accountLifecycle = createAccountLifecycleMaintenance({
    executor: infrastructure.db,
    messaging: notifications.messaging,
    accessSecurity: createAccessSecurityContext(infrastructure.db),
  });

  const leadReservation = createLeadReservationMaintenance({
    executor: infrastructure.db,
  });

  return {
    applicationConfig,
    extension,
    files,
    notifications,
    engine,
    organizationEnrichment,
    clientSearch,
    recordImports,
    merchantStats,
    maintenance: {
      accountLifecycle,
      cleanupSessions: (context: OperationContext) =>
        runSessionCleanupTick(infrastructure.db, context),
      leadReservation,
      sweepExtensionRecordings: extension.sweepIdleRecordings,
      createRecordsImportQueue: recordImports.createQueue,
    },
  };
}

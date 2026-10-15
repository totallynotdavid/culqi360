import type { Kysely } from "kysely";

import { createAuditActionPoliciesRepo } from "~/server/audit-reader/audit-policy-repo";
import { createAuthEventsRepo } from "~/server/auth/repos-auth-events";
import { createAuthThrottleRepo } from "~/server/auth/repos-auth-throttle";
import { createLoginFlowsRepo } from "~/server/auth/repos-login-flows";
import { createOAuthAccountsRepo } from "~/server/auth/repos-oauth-accounts";
import { createPasswordResetTokensRepo } from "~/server/auth/repos-password-reset";
import { createUserRecoveryCodesRepo } from "~/server/auth/repos-user-recovery-codes";
import { createUserTotpFactorsRepo } from "~/server/auth/repos-user-totp-factors";
import { createCapacityRequestsRepo } from "~/server/capacity/infrastructure/capacity-requests-repo";
import {
  createLeadPolicyDefaultsRepo,
  createLeadPolicyOverridesRepo,
  createSearchPolicyDefaultsRepo,
  createSearchPolicyOverridesRepo,
} from "~/server/capacity/infrastructure/policy-repos";
import {
  createLeadCapacityGrantsRepo,
  createLeadUsageCommitsRepo,
  createLeadUsageReservationsRepo,
  createSearchCapacityGrantsRepo,
  createSearchUsageCommitsRepo,
  createSearchUsageReservationsRepo,
} from "~/server/capacity/infrastructure/usage-repo";
import { createCompanyRegistryRepo } from "~/server/client-search/repository";
import { createContactAssignmentsRepo } from "~/server/contact-assignments/infrastructure/assignment-repo";
import { createContactCadenceRepo } from "~/server/contact-assignments/infrastructure/cadence-repo";
import { createInteractionLogsRepo } from "~/server/contact-assignments/infrastructure/interaction-logs-repo";
import { createExtensionRecordingsRepo } from "~/server/extension/recordings-repo";
import { createExtensionRuntimeRepo } from "~/server/extension/repos";
import { createIntegrationJobRepo } from "~/server/integrations/infrastructure/integration-job-repo";
import { createAppNotificationRepo } from "~/server/notifications/repos/app-notification";
import { createUserChannelAddressRepo } from "~/server/notifications/repos/user-channel-address";
import { createActionObservationsRepo } from "~/server/observability/repos-action-observations";
import { createAuthFunnelEventsRepo } from "~/server/observability/repos-auth-funnel-events";
import { createOrganizationRepo } from "~/server/organization/organization-repo";
import type { Database } from "~/server/platform/database/types";
import { createActionRateLimitsRepo } from "~/server/security/repos-action-rate-limits";
import { createRequestSessionsRepo } from "~/server/security/repos-request-sessions";
import { createSessionRepository } from "~/server/sessions/repos-sessions";
import { createBranchesRepo } from "~/server/users/repos-branches";
import { createPasskeysRepo } from "~/server/users/repos-passkeys";
import { createTeamsRepo } from "~/server/users/repos-teams";
import { createUserInvitesRepo } from "~/server/users/repos-user-invites";
import { createUsersRepo } from "~/server/users/repos-users";
import { createWebauthnChallengesRepo } from "~/server/users/repos-webauthn-challenges";

export function createTestRepositories(db: Kysely<Database>) {
  return {
    users: createUsersRepo(db),
    userInvites: createUserInvitesRepo(db),
    sessions: createSessionRepository(db),
    requestSessions: createRequestSessionsRepo(db),
    authEvents: createAuthEventsRepo(db),
    loginFlows: createLoginFlowsRepo(db),
    authThrottle: createAuthThrottleRepo(db),
    actionRateLimits: createActionRateLimitsRepo(db),
    userTotpFactors: createUserTotpFactorsRepo(db),
    userRecoveryCodes: createUserRecoveryCodesRepo(db),
    organization: createOrganizationRepo(db),
    searchEnrichment: createCompanyRegistryRepo(db),
    contactAssignments: createContactAssignmentsRepo(db),
    cadence: createContactCadenceRepo(db),
    searchPolicyDefaults: createSearchPolicyDefaultsRepo(db),
    searchPolicyOverrides: createSearchPolicyOverridesRepo(db),
    leadPolicyDefaults: createLeadPolicyDefaultsRepo(db),
    leadPolicyOverrides: createLeadPolicyOverridesRepo(db),
    searchCapacityGrants: createSearchCapacityGrantsRepo(db),
    searchUsageReservations: createSearchUsageReservationsRepo(db),
    searchUsageCommits: createSearchUsageCommitsRepo(db),
    leadCapacityGrants: createLeadCapacityGrantsRepo(db),
    leadUsageReservations: createLeadUsageReservationsRepo(db),
    leadUsageCommits: createLeadUsageCommitsRepo(db),
    capacityRequests: createCapacityRequestsRepo(db),
    interactionLogs: createInteractionLogsRepo(db),
    userChannelAddresses: createUserChannelAddressRepo(db),
    appNotifications: createAppNotificationRepo(db),
    actionObservations: createActionObservationsRepo(db),
    authFunnelEvents: createAuthFunnelEventsRepo(db),
    extensionRecordings: createExtensionRecordingsRepo(db),
    extensionRuntime: createExtensionRuntimeRepo(db),
    auditActionPolicies: createAuditActionPoliciesRepo(db),
    passkeys: createPasskeysRepo(db),
    webauthnChallenges: createWebauthnChallengesRepo(db),
    oauthAccounts: createOAuthAccountsRepo(db),
    passwordResetTokens: createPasswordResetTokensRepo(db),
    branches: createBranchesRepo(db),
    teams: createTeamsRepo(db),
    integrationJobs: createIntegrationJobRepo(db),
  };
}

export type TestRepositories = ReturnType<typeof createTestRepositories>;

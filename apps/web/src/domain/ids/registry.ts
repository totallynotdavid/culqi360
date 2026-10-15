import type { BrandedId } from "./brand";
import { derivedKey, uuidId } from "./kind";

export type UserId = BrandedId<"UserId">;
export const UserId = uuidId("UserId");

export type TeamId = BrandedId<"TeamId">;
export const TeamId = uuidId("TeamId");

export type BranchId = BrandedId<"BranchId">;
export const BranchId = uuidId("BranchId");

export type OrganizationId = BrandedId<"OrganizationId">;
export const OrganizationId = uuidId("OrganizationId");

export type PersonId = BrandedId<"PersonId">;
export const PersonId = uuidId("PersonId");

export type OrganizationPersonId = BrandedId<"OrganizationPersonId">;
export const OrganizationPersonId = uuidId("OrganizationPersonId");

export type ContactAssignmentId = BrandedId<"ContactAssignmentId">;
export const ContactAssignmentId = uuidId("ContactAssignmentId");

export type InteractionLogId = BrandedId<"InteractionLogId">;
export const InteractionLogId = uuidId("InteractionLogId");

export type CapacityRequestId = BrandedId<"CapacityRequestId">;
export const CapacityRequestId = uuidId("CapacityRequestId");

export type SearchReservationId = BrandedId<"SearchReservationId">;
export const SearchReservationId = uuidId("SearchReservationId");

export type LeadReservationId = BrandedId<"LeadReservationId">;
export const LeadReservationId = uuidId("LeadReservationId");

export type EventId = BrandedId<"EventId">;
export const EventId = uuidId("EventId");

export type WorkflowLeadId = BrandedId<"WorkflowLeadId">;
export const WorkflowLeadId = uuidId("WorkflowLeadId");

export type WorkflowInquiryId = BrandedId<"WorkflowInquiryId">;
export const WorkflowInquiryId = uuidId("WorkflowInquiryId");

export type WorkflowRateProposalId = BrandedId<"WorkflowRateProposalId">;
export const WorkflowRateProposalId = uuidId("WorkflowRateProposalId");

export type WorkflowRateRevisionId = BrandedId<"WorkflowRateRevisionId">;
export const WorkflowRateRevisionId = uuidId("WorkflowRateRevisionId");

export type WorkflowRateRevisionFileId =
  BrandedId<"WorkflowRateRevisionFileId">;
export const WorkflowRateRevisionFileId = uuidId("WorkflowRateRevisionFileId");

export type FileAssetId = BrandedId<"FileAssetId">;
export const FileAssetId = uuidId("FileAssetId");

export type FileDownloadTokenId = BrandedId<"FileDownloadTokenId">;
export const FileDownloadTokenId = uuidId("FileDownloadTokenId");

export type WorkflowVenueId = BrandedId<"WorkflowVenueId">;
export const WorkflowVenueId = uuidId("WorkflowVenueId");

export type FulfillmentOrderId = BrandedId<"FulfillmentOrderId">;
export const FulfillmentOrderId = uuidId("FulfillmentOrderId");

export type IntegrationJobId = BrandedId<"IntegrationJobId">;
export const IntegrationJobId = uuidId("IntegrationJobId");

export type GpvSnapshotId = BrandedId<"GpvSnapshotId">;
export const GpvSnapshotId = uuidId("GpvSnapshotId");

export type GpvSnapshotJobId = BrandedId<"GpvSnapshotJobId">;
export const GpvSnapshotJobId = uuidId("GpvSnapshotJobId");

export type GpvSnapshotPlacementId = BrandedId<"GpvSnapshotPlacementId">;
export const GpvSnapshotPlacementId = uuidId("GpvSnapshotPlacementId");

export type GpvSnapshotIssueId = BrandedId<"GpvSnapshotIssueId">;
export const GpvSnapshotIssueId = uuidId("GpvSnapshotIssueId");

export type CommissionSchemeVersionId = BrandedId<"CommissionSchemeVersionId">;
export const CommissionSchemeVersionId = uuidId("CommissionSchemeVersionId");

export type OrganizationOwnerAssignmentId =
  BrandedId<"OrganizationOwnerAssignmentId">;
export const OrganizationOwnerAssignmentId = uuidId(
  "OrganizationOwnerAssignmentId",
);

export type MerchantMonthCreditAdjustmentId =
  BrandedId<"MerchantMonthCreditAdjustmentId">;
export const MerchantMonthCreditAdjustmentId = uuidId(
  "MerchantMonthCreditAdjustmentId",
);

export type NotificationDeliveryId = BrandedId<"NotificationDeliveryId">;
export const NotificationDeliveryId = uuidId("NotificationDeliveryId");

export type AppNotificationId = BrandedId<"AppNotificationId">;
export const AppNotificationId = uuidId("AppNotificationId");

export type CompanyRegistryRecordId = BrandedId<"CompanyRegistryRecordId">;
export const CompanyRegistryRecordId = uuidId("CompanyRegistryRecordId");

export type UserInviteId = BrandedId<"UserInviteId">;
export const UserInviteId = uuidId("UserInviteId");

export type AuthLoginFlowId = BrandedId<"AuthLoginFlowId">;
export const AuthLoginFlowId = uuidId("AuthLoginFlowId");

export type WebauthnChallengeId = BrandedId<"WebauthnChallengeId">;
export const WebauthnChallengeId = uuidId("WebauthnChallengeId");

export type RecoveryCodeSetId = BrandedId<"RecoveryCodeSetId">;
export const RecoveryCodeSetId = uuidId("RecoveryCodeSetId");

export type RecoveryCodeId = BrandedId<"RecoveryCodeId">;
export const RecoveryCodeId = uuidId("RecoveryCodeId");

export type InstallationId = BrandedId<"InstallationId">;
export const InstallationId = uuidId("InstallationId");

export type ExtensionCallId = BrandedId<"ExtensionCallId">;
export const ExtensionCallId = uuidId("ExtensionCallId");

export type ExtensionRecordingId = BrandedId<"ExtensionRecordingId">;
export const ExtensionRecordingId = uuidId("ExtensionRecordingId");

// Derive deterministic idempotency keys from (sourceEventId, discriminator)
// instead of generating UUIDs.
export type NotificationIntentId = BrandedId<"NotificationIntentId">;
export const NotificationIntentId = derivedKey("NotificationIntentId");

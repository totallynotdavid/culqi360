import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import type {
  AcceptRateInput,
  AddLeadNoteInput,
  AddVenueAccountsInput,
  ChooseFulfillmentProductInput,
  CloseLeadInput,
  CreateInquiryInput,
  CreateLeadInput,
  CreateVenueInput,
  EditCommercialScopeInput,
  EditRateProposalInput,
  ProposeRateInput,
  ReassignLeadInput,
  RecordRepLegalInput,
  RecordUnitSerialInput,
  RegisterUnitPaymentLinkInput,
  RegisterUnitSaleInput,
  RejectFulfillmentStepInput,
  RequestRateRevisionInput,
  RestartQuotationInput,
  ReviewLeadInput,
  SaveDigitalPolicyInput,
  UpdateVenueInput,
} from "~/contracts/workflow/inputs";
import {
  chooseFulfillmentProduct,
  recordFulfillmentSerial,
  registerFulfillmentPaymentLink,
  registerFulfillmentSale,
  rejectFulfillmentStep,
  uploadFulfillmentDocument,
  uploadFulfillmentPaymentProof,
  validateFulfillmentPayment,
} from "~/rpc/workflow/commands/fulfillment";
import { requestInquiryCreation } from "~/rpc/workflow/commands/inquiries";
import { addLeadNote } from "~/rpc/workflow/commands/interactions";
import {
  requestRateAcceptance,
  requestRateProposal,
  requestLeadClosure,
  requestRateProposalEdit,
  requestRateRevision,
} from "~/rpc/workflow/commands/rate";
import {
  requestAddLeadToFavorites,
  requestEditCommercialScope,
  requestLeadCreation,
  requestLeadDeletion,
  requestLeadReassignment,
  requestLeadReview,
  requestQuotationRestart,
  requestRecordRepLegal,
  requestRemoveLeadFromFavorites,
  requestSaveDigitalPolicy,
} from "~/rpc/workflow/commands/records";
import {
  requestVenueAccountsAddition,
  requestVenueCreation,
  requestVenueUpdate,
} from "~/rpc/workflow/commands/sales";
import { inquiryListQuery } from "~/rpc/workflow/inquiry-list";
import { leadListQuery } from "~/rpc/workflow/lead-list";

export const createLeadMutation = action(async (input: CreateLeadInput) => {
  const result = await requestLeadCreation(input);
  const revalidate = input.inquiryId
    ? [leadListQuery.key, inquiryListQuery.key]
    : leadListQuery.key;

  return respond(result, { revalidate });
}, "workflow.createLead");

export const createInquiryMutation = action(
  (input: CreateInquiryInput) => requestInquiryCreation(input),
  "workflow.createInquiry",
);

export const addNoteMutation = action(
  (input: AddLeadNoteInput) => addLeadNote(input),
  "workflow.addNote",
);

export const proposeRateMutation = action(
  (input: ProposeRateInput) => requestRateProposal(input),
  "workflow.proposeRate",
);

export const editRateProposalMutation = action(
  (input: EditRateProposalInput) => requestRateProposalEdit(input),
  "workflow.editRateProposal",
);

export const acceptRateMutation = action(
  (input: AcceptRateInput) => requestRateAcceptance(input),
  "workflow.acceptRate",
);

export const requestRateRevisionMutation = action(
  (input: RequestRateRevisionInput) => requestRateRevision(input),
  "workflow.requestRateRevision",
);

export const closeLeadMutation = action(
  (input: CloseLeadInput) => requestLeadClosure(input),
  "workflow.closeLead",
);

export const saveDigitalPolicyMutation = action(
  (input: SaveDigitalPolicyInput) => requestSaveDigitalPolicy(input),
  "workflow.saveDigitalPolicy",
);

export const recordRepLegalMutation = action(
  (input: RecordRepLegalInput) => requestRecordRepLegal(input),
  "workflow.recordRepLegal",
);

export const createVenueMutation = action(
  (input: CreateVenueInput) => requestVenueCreation(input),
  "workflow.createVenue",
);

export const updateVenueMutation = action(
  (input: UpdateVenueInput) => requestVenueUpdate(input),
  "workflow.updateVenue",
);

export const addVenueAccountsMutation = action(
  (input: AddVenueAccountsInput) => requestVenueAccountsAddition(input),
  "workflow.addVenueAccounts",
);

export const reassignLeadMutation = action(
  (input: ReassignLeadInput) => requestLeadReassignment(input),
  "workflow.reassignLead",
);

export const reviewLeadMutation = action(
  (input: ReviewLeadInput) => requestLeadReview(input),
  "workflow.reviewLead",
);

export const restartQuotationMutation = action(
  (input: RestartQuotationInput) => requestQuotationRestart(input),
  "workflow.restartQuotation",
);

export const editCommercialScopeMutation = action(
  (input: EditCommercialScopeInput) => requestEditCommercialScope(input),
  "workflow.editCommercialScope",
);

export const addLeadToFavoritesMutation = action(
  (input: { leadId: string }) => requestAddLeadToFavorites(input),
  "workflow.addLeadToFavorites",
);

export const removeLeadFromFavoritesMutation = action(
  (input: { leadId: string }) => requestRemoveLeadFromFavorites(input),
  "workflow.removeLeadFromFavorites",
);

export const deleteLeadMutation = action(
  (input: { leadId: string }) => requestLeadDeletion(input),
  "workflow.deleteLead",
);

export const chooseFulfillmentProductMutation = action(
  (input: ChooseFulfillmentProductInput) => chooseFulfillmentProduct(input),
  "workflow.chooseFulfillmentProduct",
);

export const uploadFulfillmentDocumentMutation = action(
  (formData: FormData) => uploadFulfillmentDocument(formData),
  "workflow.uploadFulfillmentDocument",
);

export const recordFulfillmentSerialMutation = action(
  (input: RecordUnitSerialInput) => recordFulfillmentSerial(input),
  "workflow.recordFulfillmentSerial",
);

export const registerFulfillmentPaymentLinkMutation = action(
  (input: RegisterUnitPaymentLinkInput) =>
    registerFulfillmentPaymentLink(input),
  "workflow.registerFulfillmentPaymentLink",
);

export const uploadFulfillmentPaymentProofMutation = action(
  (formData: FormData) => uploadFulfillmentPaymentProof(formData),
  "workflow.uploadFulfillmentPaymentProof",
);

export const validateFulfillmentPaymentMutation = action(
  (input: { leadId: string }) => validateFulfillmentPayment(input),
  "workflow.validateFulfillmentPayment",
);

export const registerFulfillmentSaleMutation = action(
  (input: RegisterUnitSaleInput) => registerFulfillmentSale(input),
  "workflow.registerFulfillmentSale",
);

export const rejectFulfillmentStepMutation = action(
  (input: RejectFulfillmentStepInput) => rejectFulfillmentStep(input),
  "workflow.rejectFulfillmentStep",
);

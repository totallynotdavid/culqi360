import type {
  LeadRateRevisionFileView,
  LeadSaleProofFileView,
} from "~/contracts/workflow/results";
import type {
  FulfillmentAction,
  FulfillmentDocKind,
} from "~/contracts/workflow/vocabulary";
import { hasPermission } from "~/domain/auth/access/rbac";
import { fail, forbidden, type DomainError } from "~/domain/errors";
import type {
  FileAssetId,
  WorkflowLeadId,
  WorkflowRateRevisionFileId,
} from "~/domain/ids";
import { appCalendarDateAt } from "~/domain/time/app-time";
import type { FileRepos } from "~/server/files/service/contracts";
import { issueDownloadToken } from "~/server/files/service/issue-download-token";
import { storeGeneratedFile } from "~/server/files/service/store-generated-file";
import { storeUploadedFile } from "~/server/files/service/store-uploaded-file";
import { buildRecordExportCsv } from "~/server/integrations/infrastructure/lead-export-builder";
import type { AppContext } from "~/server/platform/action/context";
import type { DatabaseExecutor } from "~/server/platform/database/executor";
import type { BlobStore } from "~/server/platform/files/blob-store";
import {
  exportPendingInquiries,
  type InquiryExportRow,
} from "~/server/workflow/inquiry/inquiry-queries";
import { authorizeLeadAction } from "~/server/workflow/lead/domain/policy";
import {
  attachFulfillmentDocumentCommand,
  uploadUnitPaymentProofCommand,
} from "~/server/workflow/lead/fulfillment/commands";
import type { FulfillmentRepository } from "~/server/workflow/lead/fulfillment/repo";
import { docKindForAction } from "~/server/workflow/lead/fulfillment/steps";
import type {
  LeadQueries,
  RecordExportRow,
} from "~/server/workflow/lead/read/lead-queries";
import type { LeadReader } from "~/server/workflow/lead/read/ports";
import { Err, Ok, type Result } from "~/shared/result";

// Leads awaiting review and pending availability inquiries ride the same CSV
// through the external availability platform, which keys on RUC. Inquiry rows
// carry the sentinel stage CONSULTA so back office can tell them apart from
// quotation work at a glance.
const LEAD_EXPORT_COLUMNS: {
  header: string;
  lead: (row: RecordExportRow) => unknown;
  inquiry: (row: InquiryExportRow) => unknown;
}[] = [
  { header: "RUC", lead: (row) => row.ruc, inquiry: (row) => row.ruc },
  {
    header: "Razón social",
    lead: (row) => row.legalName ?? "",
    inquiry: (row) => row.legalName ?? "",
  },
  {
    header: "ID ejecutivo",
    lead: (row) => row.executiveId,
    inquiry: (row) => row.executiveId,
  },
  {
    header: "Ejecutivo",
    lead: (row) => row.executiveName,
    inquiry: (row) => row.executiveName,
  },
  {
    header: "Fecha de registro",
    lead: (row) => appCalendarDateAt(row.createdAt),
    inquiry: (row) => appCalendarDateAt(row.createdAt),
  },
  { header: "Etapa", lead: (row) => row.stage, inquiry: () => "CONSULTA" },
  { header: "Dirección", lead: (row) => row.address ?? "", inquiry: () => "" },
  { header: "Estado", lead: (row) => row.status ?? "", inquiry: () => "" },
  { header: "Prioridad", lead: (row) => row.priority ?? "", inquiry: () => "" },
  {
    header: "Competencia",
    lead: (row) => row.currentProvider ?? "",
    inquiry: () => "",
  },
  {
    header: "Tasa comp. TD",
    lead: (row) => row.currentDebitRate ?? "",
    inquiry: () => "",
  },
  {
    header: "Tasa comp. TC",
    lead: (row) => row.currentCreditRate ?? "",
    inquiry: () => "",
  },
  {
    header: "Tasa Culqi TD",
    lead: (row) => row.proposedDebitRate ?? "",
    inquiry: () => "",
  },
  {
    header: "Tasa Culqi TC",
    lead: (row) => row.proposedCreditRate ?? "",
    inquiry: () => "",
  },
  { header: "Proyectado", lead: (row) => row.gpv ?? "", inquiry: () => "" },
  { header: "Observación", lead: () => "", inquiry: () => "" },
];

type LeadFilesDeps = {
  leadReader: LeadReader;
  leadQueries: LeadQueries;
  fulfillment: FulfillmentRepository;
  filesRepo: FileRepos;
  filesStorage: BlobStore;
  executor: DatabaseExecutor;
};

type UploadedFile = {
  name: string;
  sizeBytes: number;
  stream: ReadableStream<Uint8Array>;
};

async function requireReadableLead(
  deps: LeadFilesDeps,
  input: {
    leadId: WorkflowLeadId;
    ctx: AppContext;
  },
): Promise<
  Result<NonNullable<Awaited<ReturnType<LeadReader["findById"]>>>, DomainError>
> {
  const lead = await deps.leadReader.findById(input.leadId);

  if (!lead) {
    return Err(fail("lead_not_found"));
  }

  const access = authorizeLeadAction(
    "view",
    {
      userId: input.ctx.actor.userId,
      role: input.ctx.actor.role,
    },
    lead,
  );

  if (!access.ok) {
    return access;
  }

  return Ok(lead);
}

function mapSaleProofFile(record: {
  id: string;
  fileAssetId: FileAssetId;
  safeDisplayFilename: string;
  detectedMime: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedByUserId: string;
}): LeadSaleProofFileView {
  return {
    id: record.id,
    fileId: record.fileAssetId,
    filename: record.safeDisplayFilename,
    detectedMime: record.detectedMime,
    sizeBytes: record.sizeBytes,
    uploadedAt: record.createdAt.getTime(),
    uploadedByUserId: record.uploadedByUserId,
    status: "ready",
  };
}

function mapRateRevisionFile(record: {
  id: WorkflowRateRevisionFileId;
  safeDisplayFilename: string;
  detectedMime: string;
  sizeBytes: number;
}): LeadRateRevisionFileView {
  return {
    fileId: record.id,
    filename: record.safeDisplayFilename,
    detectedMime: record.detectedMime,
    sizeBytes: record.sizeBytes,
  };
}

export function createLeadFilesService(deps: LeadFilesDeps) {
  async function uploadFulfillmentFileForAction(input: {
    ctx: AppContext;
    leadId: WorkflowLeadId;
    action: FulfillmentAction;
    docKind: FulfillmentDocKind;
    file: UploadedFile;
  }): Promise<Result<{ leadId: string }, DomainError>> {
    const leadResult = await requireReadableLead(deps, input);

    if (!leadResult.ok) {
      return leadResult;
    }

    if (leadResult.value.stage !== "FULFILLMENT") {
      return Err(fail("lead_not_in_fulfillment"));
    }

    const storedFile = await storeUploadedFile(
      input.ctx,
      {
        purpose: input.docKind,
        ...input.file,
      },
      {
        repo: deps.filesRepo,
        storage: deps.filesStorage,
      },
    );

    if (!storedFile.ok) {
      return storedFile;
    }

    return attachFulfillmentDocumentCommand(
      {
        leadId: input.leadId,
        fileAssetId: storedFile.value.id,
        action: input.action,
        actor: {
          userId: input.ctx.actor.userId,
          role: input.ctx.actor.role,
          branchId: input.ctx.actor.branchId,
        },
      },
      { executor: deps.executor, operationAt: input.ctx.operationAt },
    );
  }

  return {
    async requestLeadsExportDownloadToken(input: {
      ctx: AppContext;
    }): Promise<Result<{ token: string }, DomainError>> {
      if (!hasPermission(input.ctx.actor.role, "integration:manage")) {
        return Err(forbidden());
      }

      const filters = {
        actorUserId: input.ctx.actor.userId,
        actorRole: input.ctx.actor.role,
        actorBranchId: input.ctx.actor.branchId,
      };
      const rows = await deps.leadQueries.export(filters);
      const inquiryRows = await exportPendingInquiries(deps.executor, filters);

      const csv = buildRecordExportCsv(
        LEAD_EXPORT_COLUMNS.map((column) => column.header),
        [
          ...rows.map((row) =>
            LEAD_EXPORT_COLUMNS.map((column) => column.lead(row)),
          ),
          ...inquiryRows.map((row) =>
            LEAD_EXPORT_COLUMNS.map((column) => column.inquiry(row)),
          ),
        ],
      );

      const storedFile = await storeGeneratedFile(
        input.ctx,
        {
          purpose: "records_export",
          filename: "records-export.csv",
          bytes: new TextEncoder().encode(csv),
        },
        {
          repo: deps.filesRepo,
          storage: deps.filesStorage,
        },
      );

      if (!storedFile.ok) {
        return storedFile;
      }

      return issueDownloadToken(input.ctx, storedFile.value.id, {
        repo: deps.filesRepo,
      });
    },

    async listSaleProofFiles(input: {
      ctx: AppContext;
      leadId: WorkflowLeadId;
    }): Promise<Result<LeadSaleProofFileView[], DomainError>> {
      const leadResult = await requireReadableLead(deps, input);

      if (!leadResult.ok) {
        return leadResult;
      }

      const records = await deps.filesRepo.sales.listByLead(input.leadId);

      return Ok(records.map(mapSaleProofFile));
    },

    async uploadSaleProofFile(input: {
      ctx: AppContext;
      leadId: WorkflowLeadId;
      file: UploadedFile;
    }): Promise<Result<LeadSaleProofFileView, DomainError>> {
      const leadResult = await requireReadableLead(deps, input);

      if (!leadResult.ok) {
        return leadResult;
      }

      if (leadResult.value.stage !== "LIVE") {
        return Err(fail("lead_not_live"));
      }

      if (!hasPermission(input.ctx.actor.role, "lead:sale:upload-proof")) {
        return Err(forbidden());
      }

      const storedFile = await storeUploadedFile(
        input.ctx,
        {
          purpose: "sale_proof",
          ...input.file,
        },
        {
          repo: deps.filesRepo,
          storage: deps.filesStorage,
        },
      );

      if (!storedFile.ok) {
        return storedFile;
      }

      const createdAt = input.ctx.operationAt;

      const id = await deps.filesRepo.sales.insert({
        leadId: input.leadId,
        fileAssetId: storedFile.value.id,
        uploadedByUserId: input.ctx.actor.userId,
        createdAt,
      });

      return Ok(
        mapSaleProofFile({
          id,
          fileAssetId: storedFile.value.id,
          safeDisplayFilename: storedFile.value.safeDisplayFilename,
          detectedMime: storedFile.value.detectedMime,
          sizeBytes: storedFile.value.sizeBytes,
          createdAt,
          uploadedByUserId: input.ctx.actor.userId,
        }),
      );
    },

    async requestSaleProofDownloadToken(input: {
      ctx: AppContext;
      leadId: WorkflowLeadId;
      fileAssetId: FileAssetId;
    }): Promise<Result<{ token: string }, DomainError>> {
      const leadResult = await requireReadableLead(deps, input);

      if (!leadResult.ok) {
        return leadResult;
      }

      const saleProof = await deps.filesRepo.sales.findByFileAssetId({
        leadId: input.leadId,
        fileAssetId: input.fileAssetId,
      });

      if (!saleProof) {
        return Err(fail("sale_proof_not_found"));
      }

      return issueDownloadToken(input.ctx, saleProof.fileAssetId, {
        repo: deps.filesRepo,
      });
    },

    async uploadRateRevisionFile(input: {
      ctx: AppContext;
      leadId: WorkflowLeadId;
      file: UploadedFile;
    }): Promise<Result<LeadRateRevisionFileView, DomainError>> {
      const leadResult = await requireReadableLead(deps, input);

      if (!leadResult.ok) {
        return leadResult;
      }

      if (leadResult.value.stage !== "PRICING") {
        return Err(fail("lead_not_in_pricing"));
      }

      if (leadResult.value.executiveId !== input.ctx.actor.userId) {
        return Err(forbidden());
      }

      const storedFile = await storeUploadedFile(
        input.ctx,
        {
          purpose: "rate_revision_file",
          ...input.file,
        },
        {
          repo: deps.filesRepo,
          storage: deps.filesStorage,
        },
      );

      if (!storedFile.ok) {
        return storedFile;
      }

      const stagedFile = await deps.filesRepo.rateRevision.stage({
        leadId: input.leadId,
        fileAssetId: storedFile.value.id,
        uploadedByUserId: input.ctx.actor.userId,
        createdAt: input.ctx.operationAt,
      });

      return Ok(mapRateRevisionFile(stagedFile));
    },

    async requestRateRevisionDownloadToken(input: {
      ctx: AppContext;
      leadId: WorkflowLeadId;
      fileId: WorkflowRateRevisionFileId;
    }): Promise<Result<{ token: string }, DomainError>> {
      const leadResult = await requireReadableLead(deps, input);

      if (!leadResult.ok) {
        return leadResult;
      }

      const record = await deps.filesRepo.rateRevision.findById(input.fileId);

      if (!record || record.leadId !== input.leadId) {
        return Err(fail("file_not_found"));
      }

      return issueDownloadToken(input.ctx, record.fileAssetId, {
        repo: deps.filesRepo,
      });
    },

    async uploadFulfillmentDocument(input: {
      ctx: AppContext;
      leadId: WorkflowLeadId;
      action: FulfillmentAction;
      file: UploadedFile;
    }): Promise<Result<{ leadId: string }, DomainError>> {
      const docKind = docKindForAction(input.action);

      if (docKind === null) {
        return Err(fail("invalid_fulfillment_action"));
      }

      return uploadFulfillmentFileForAction({
        ctx: input.ctx,
        leadId: input.leadId,
        action: input.action,
        docKind,
        file: input.file,
      });
    },

    async uploadFulfillmentPaymentProof(input: {
      ctx: AppContext;
      leadId: WorkflowLeadId;
      unitId: string;
      file: UploadedFile;
    }): Promise<Result<{ leadId: string }, DomainError>> {
      const leadResult = await requireReadableLead(deps, input);

      if (!leadResult.ok) {
        return leadResult;
      }

      if (leadResult.value.stage !== "FULFILLMENT") {
        return Err(fail("lead_not_in_fulfillment"));
      }

      const storedFile = await storeUploadedFile(
        input.ctx,
        {
          purpose: "payment_proof",
          ...input.file,
        },
        {
          repo: deps.filesRepo,
          storage: deps.filesStorage,
        },
      );

      if (!storedFile.ok) {
        return storedFile;
      }

      return uploadUnitPaymentProofCommand(
        {
          leadId: input.leadId,
          unitId: input.unitId,
          fileAssetId: storedFile.value.id,
          actor: {
            userId: input.ctx.actor.userId,
            role: input.ctx.actor.role,
            branchId: input.ctx.actor.branchId,
          },
        },
        { executor: deps.executor, operationAt: input.ctx.operationAt },
      );
    },

    async requestFulfillmentDownloadToken(input: {
      ctx: AppContext;
      leadId: WorkflowLeadId;
      fileAssetId: FileAssetId;
    }): Promise<Result<{ token: string }, DomainError>> {
      const leadResult = await requireReadableLead(deps, input);

      if (!leadResult.ok) {
        return leadResult;
      }

      const details = await deps.fulfillment.findByLeadId(input.leadId);

      if (!details) {
        return Err(fail("fulfillment_not_started"));
      }

      const document = await deps.fulfillment.findDocumentByFileAssetId({
        orderId: details.order.id,
        fileAssetId: input.fileAssetId,
      });

      if (!document) {
        return Err(fail("fulfillment_document_not_found"));
      }

      return issueDownloadToken(input.ctx, document.fileAssetId, {
        repo: deps.filesRepo,
      });
    },
  };
}

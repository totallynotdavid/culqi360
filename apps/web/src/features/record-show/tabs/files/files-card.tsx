import { createSignal, For, Show } from "solid-js";

import Plus from "~/components/icons/plus";
import { Button } from "~/components/ui/input/button";
import { actionErrorMessage } from "~/contracts/errors";
import { describeDocKind } from "~/contracts/workflow/fulfillment-labels";
import type { LeadSaleProofFileView } from "~/contracts/workflow/results";
import type {
  LeadDetailFulfillmentView,
  LeadDetailRateRevisionView,
} from "~/contracts/workflow/views";
import {
  ActivitySection,
  ActivityListCard,
  ActivityListRow,
  ActivityRowBody,
  ActivityRowTitle,
  ActivityRowMeta,
  ActivityTabContainer,
} from "~/features/side-panel/components/activity-tabs/primitives";
import { requestFulfillmentDownloadToken } from "~/rpc/workflow/commands/fulfillment";
import {
  requestLeadSaleProofDownloadToken,
  requestRateRevisionFileDownloadToken,
} from "~/rpc/workflow/files";

import { AttachmentList } from "./attachment-list";
import { PreviewModal, type PreviewModalState } from "./preview-modal";
import { useAttachments } from "./use-attachments";
import { useUploadAttachmentFile } from "./use-upload-attachment-file";

import styles from "./files.module.css";

type FilesCardProps = {
  leadId: string;
  canUpload: boolean;
  rateRevisions?: LeadDetailRateRevisionView[];
  fulfillment?: LeadDetailFulfillmentView | null;
};

function hasDraggedFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function FilesCard(props: FilesCardProps) {
  const [fileActionErrorMessage, setFileActionErrorMessage] = createSignal<
    string | null
  >(null);
  const [isDraggingFile, setIsDraggingFile] = createSignal(false);
  const [previewState, setPreviewState] =
    createSignal<PreviewModalState | null>(null);
  const [fileInputRef, setFileInputRef] = createSignal<HTMLInputElement>();

  let dragEnterCount = 0;

  const { attachments, refetch } = useAttachments(() => props.leadId);
  const { uploading, uploadAttachmentFile } = useUploadAttachmentFile({
    leadId: () => props.leadId,
  });

  const rateRevisions = () => props.rateRevisions ?? [];
  const revisionFileCount = () =>
    rateRevisions().reduce(
      (count, revision) => count + revision.files.length,
      0,
    );
  const fulfillmentDocuments = () => props.fulfillment?.documents ?? [];

  async function uploadFiles(files: File[]) {
    if (!props.canUpload || files.length === 0) {
      return;
    }

    setFileActionErrorMessage(null);

    try {
      await Promise.all(files.map((file) => uploadAttachmentFile(file)));
      refetch();
    } catch (caught) {
      setFileActionErrorMessage(
        caught instanceof Error
          ? caught.message
          : "No se pudo subir el archivo",
      );
    }
  }

  async function handleDownload(fileId: string) {
    setFileActionErrorMessage(null);

    try {
      const token = await requestLeadSaleProofDownloadToken({
        leadId: props.leadId,
        fileId,
      });

      window.location.href = `/api/files/download/${token.token}`;
    } catch (caught) {
      setFileActionErrorMessage(
        caught instanceof Error
          ? caught.message
          : "No se pudo descargar el archivo",
      );
    }
  }

  async function handlePreview(file: LeadSaleProofFileView) {
    setFileActionErrorMessage(null);

    try {
      const token = await requestLeadSaleProofDownloadToken({
        leadId: props.leadId,
        fileId: file.fileId,
      });

      setPreviewState({
        file: {
          previewId: `sale-proof-${file.id}`,
          fileId: file.fileId,
          filename: file.filename,
          detectedMime: file.detectedMime,
        },
        previewUrl: `/api/files/download/${token.token}?inline=1`,
        onDownload: () => handleDownload(file.fileId),
      });
    } catch (caught) {
      setFileActionErrorMessage(
        caught instanceof Error
          ? caught.message
          : "No se pudo abrir la vista previa",
      );
    }
  }

  async function handleRevisionDownload(leadId: string, fileId: string) {
    setFileActionErrorMessage(null);

    const result = await requestRateRevisionFileDownloadToken({
      leadId,
      fileId,
    });

    if (result.ok) {
      window.location.href = `/api/files/download/${result.value.token}`;
    } else {
      setFileActionErrorMessage(actionErrorMessage(result.error));
    }
  }

  async function handleRevisionPreview(file: {
    fileId: string;
    filename: string;
    detectedMime: string;
  }) {
    setFileActionErrorMessage(null);

    const result = await requestRateRevisionFileDownloadToken({
      leadId: props.leadId,
      fileId: file.fileId,
    });

    if (result.ok) {
      setPreviewState({
        file: {
          previewId: `rate-revision-${file.fileId}`,
          fileId: file.fileId,
          filename: file.filename,
          detectedMime: file.detectedMime,
        },
        previewUrl: `/api/files/download/${result.value.token}?inline=1`,
        onDownload: () => handleRevisionDownload(props.leadId, file.fileId),
      });
    } else {
      setFileActionErrorMessage(actionErrorMessage(result.error));
    }
  }

  async function handleFulfillmentDownload(fileId: string) {
    setFileActionErrorMessage(null);

    try {
      const token = await requestFulfillmentDownloadToken({
        leadId: props.leadId,
        fileId,
      });

      window.location.href = `/api/files/download/${token.token}`;
    } catch (caught) {
      setFileActionErrorMessage(
        caught instanceof Error
          ? caught.message
          : "No se pudo descargar el archivo",
      );
    }
  }

  async function handleFulfillmentPreview(document: {
    fileId: string;
    filename: string;
    detectedMime: string;
  }) {
    setFileActionErrorMessage(null);

    try {
      const token = await requestFulfillmentDownloadToken({
        leadId: props.leadId,
        fileId: document.fileId,
      });

      setPreviewState({
        file: {
          previewId: `fulfillment-${document.fileId}`,
          fileId: document.fileId,
          filename: document.filename,
          detectedMime: document.detectedMime,
        },
        previewUrl: `/api/files/download/${token.token}?inline=1`,
        onDownload: () => handleFulfillmentDownload(document.fileId),
      });
    } catch (caught) {
      setFileActionErrorMessage(
        caught instanceof Error
          ? caught.message
          : "No se pudo abrir la vista previa",
      );
    }
  }

  return (
    <ActivityTabContainer>
      <Show when={revisionFileCount() > 0}>
        <ActivitySection
          title="Revisiones de tarifa"
          count={revisionFileCount()}
        >
          <ActivityListCard>
            <For each={rateRevisions()}>
              {(revision) => (
                <For each={revision.files}>
                  {(file) => (
                    <ActivityListRow
                      onClick={() =>
                        void handleRevisionPreview({
                          fileId: file.fileId,
                          filename: file.filename,
                          detectedMime: file.detectedMime,
                        })
                      }
                    >
                      <ActivityRowBody>
                        <ActivityRowTitle>{file.filename}</ActivityRowTitle>
                        <ActivityRowMeta>
                          Ronda {revision.round}
                        </ActivityRowMeta>
                      </ActivityRowBody>
                    </ActivityListRow>
                  )}
                </For>
              )}
            </For>
          </ActivityListCard>
        </ActivitySection>
      </Show>

      <Show when={fulfillmentDocuments().length > 0}>
        <ActivitySection title="Entrega" count={fulfillmentDocuments().length}>
          <ActivityListCard>
            <For each={fulfillmentDocuments()}>
              {(document) => (
                <ActivityListRow
                  onClick={() =>
                    void handleFulfillmentPreview({
                      fileId: document.fileId,
                      filename: document.filename,
                      detectedMime: document.detectedMime,
                    })
                  }
                >
                  <ActivityRowBody>
                    <ActivityRowTitle>{document.filename}</ActivityRowTitle>
                    <ActivityRowMeta>
                      {describeDocKind(document.docKind)}
                    </ActivityRowMeta>
                  </ActivityRowBody>
                </ActivityListRow>
              )}
            </For>
          </ActivityListCard>
        </ActivitySection>
      </Show>

      <ActivitySection
        title="Comprobantes"
        count={attachments()?.length ?? 0}
        action={
          <>
            <input
              ref={setFileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              class={styles.fileInput}
              multiple
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                void uploadFiles(files);
                event.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              class={styles.addFileButton}
              disabled={!props.canUpload || uploading()}
              loading={uploading()}
              onClick={() => fileInputRef()?.click()}
            >
              <Plus size={14} />
              Agregar archivo
            </Button>
          </>
        }
      >
        <div
          class={styles.dropTarget}
          onDragEnter={(event) => {
            if (props.canUpload && hasDraggedFiles(event)) {
              event.preventDefault();
              dragEnterCount++;
              setIsDraggingFile(true);
            }
          }}
          onDragOver={(event) => {
            if (props.canUpload && hasDraggedFiles(event)) {
              event.preventDefault();
            }
          }}
          onDragLeave={(event) => {
            if (props.canUpload && hasDraggedFiles(event)) {
              dragEnterCount = Math.max(0, dragEnterCount - 1);

              if (dragEnterCount === 0) {
                setIsDraggingFile(false);
              }
            }
          }}
          onDrop={(event) => {
            event.preventDefault();

            dragEnterCount = 0;
            setIsDraggingFile(false);

            const files = Array.from(event.dataTransfer?.files ?? []);
            void uploadFiles(files);
          }}
        >
          <AttachmentList
            attachments={attachments() ?? []}
            canUpload={props.canUpload}
            isDraggingFile={isDraggingFile()}
            onUploadFiles={uploadFiles}
            onDownload={handleDownload}
            onPreview={handlePreview}
          />
        </div>

        <Show when={fileActionErrorMessage()}>
          {(message) => <p class={styles.error}>{message()}</p>}
        </Show>
      </ActivitySection>

      <PreviewModal
        state={previewState()}
        onClose={() => setPreviewState(null)}
      />
    </ActivityTabContainer>
  );
}

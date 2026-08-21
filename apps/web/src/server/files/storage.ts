import { join } from "node:path";

import {
  createBlobStore,
  type BlobStore,
} from "~/server/platform/files/blob-store";

const WORKFLOW_FILES_DIR = "workflow-files";

export function createFileStorage(baseDir: string): BlobStore {
  return createBlobStore(join(baseDir, WORKFLOW_FILES_DIR));
}

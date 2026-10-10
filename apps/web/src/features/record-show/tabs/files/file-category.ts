export type FileCategory =
  | "archive"
  | "audio"
  | "image"
  | "presentation"
  | "spreadsheet"
  | "text_document"
  | "video"
  | "other";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "svg",
  "webp",
  "ico",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "avi",
  "mov",
  "wmv",
  "flv",
  "mkv",
  "webm",
  "m4v",
]);

const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "ogg",
  "flac",
  "m4a",
  "wma",
  "aac",
]);

const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2"]);
const SPREADSHEET_EXTENSIONS = new Set(["xls", "xlsx", "csv", "ods"]);
const PRESENTATION_EXTENSIONS = new Set(["ppt", "pptx", "odp"]);

const TEXT_DOCUMENT_EXTENSIONS = new Set([
  "doc",
  "docx",
  "txt",
  "rtf",
  "odt",
  "pdf",
  "md",
]);

export function getFileExtension(filename: string): string | null {
  const trimmed = filename.trim();
  const index = trimmed.lastIndexOf(".");

  if (index <= 0 || index === trimmed.length - 1) {
    return null;
  }

  return trimmed.slice(index + 1).toLowerCase();
}

export function getFileCategoryFromExtension(
  extension?: string | null,
): FileCategory {
  if (!extension) {
    return "other";
  }

  const ext = extension.toLowerCase().replace(/^\./, "");

  if (IMAGE_EXTENSIONS.has(ext)) {
    return "image";
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    return "video";
  }

  if (AUDIO_EXTENSIONS.has(ext)) {
    return "audio";
  }

  if (ARCHIVE_EXTENSIONS.has(ext)) {
    return "archive";
  }

  if (SPREADSHEET_EXTENSIONS.has(ext)) {
    return "spreadsheet";
  }

  if (PRESENTATION_EXTENSIONS.has(ext)) {
    return "presentation";
  }

  if (TEXT_DOCUMENT_EXTENSIONS.has(ext)) {
    return "text_document";
  }

  return "other";
}

export function getFileCategoryFromMime(mime: string): FileCategory {
  const normalized = mime.toLowerCase().split(";", 1)[0]?.trim() ?? "";

  if (normalized.startsWith("image/")) {
    return "image";
  }

  if (normalized.startsWith("video/")) {
    return "video";
  }

  if (normalized.startsWith("audio/")) {
    return "audio";
  }

  if (normalized === "application/pdf") {
    return "text_document";
  }

  if (normalized.includes("zip") || normalized.includes("compressed")) {
    return "archive";
  }

  if (
    normalized.includes("sheet") ||
    normalized.includes("excel") ||
    normalized.includes("csv")
  ) {
    return "spreadsheet";
  }

  if (
    normalized.includes("presentation") ||
    normalized.includes("powerpoint")
  ) {
    return "presentation";
  }

  if (
    normalized.startsWith("text/") ||
    normalized.includes("word") ||
    normalized.includes("document")
  ) {
    return "text_document";
  }

  return "other";
}

import type {
  RecordCandidate,
  RecordCandidatesResponse,
} from "~/contracts/engine/record-api.generated";
import {
  isSearchResult,
  type SearchResponse,
} from "~/contracts/search/engine-results.generated";
import { isPlainRecord } from "~/shared/type-guards";

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isRecordCandidate(value: unknown): value is RecordCandidate {
  if (!isPlainRecord(value)) {
    return false;
  }
  return (
    typeof value.ruc === "string" &&
    typeof value.organization_name === "string" &&
    typeof value.dni === "string" &&
    typeof value.person_name === "string" &&
    typeof value.phone_primary === "string"
  );
}

export function decodeSearchResponse(value: unknown): SearchResponse {
  if (
    !isPlainRecord(value) ||
    !isArray(value.results) ||
    typeof value.count !== "number"
  ) {
    throw new Error("Invalid SearchResponse structure");
  }

  if (!value.results.every(isSearchResult)) {
    const badRow = value.results.findIndex((row) => !isSearchResult(row));
    throw new Error(`Invalid SearchResponse row at results[${badRow}]`);
  }

  return { results: value.results, count: value.count };
}

export function decodeRecordCandidatesResponse(
  value: unknown,
): RecordCandidatesResponse {
  if (
    !isPlainRecord(value) ||
    !isArray(value.candidates) ||
    !value.candidates.every(isRecordCandidate)
  ) {
    throw new Error("Invalid RecordCandidatesResponse structure");
  }

  return {
    candidates: value.candidates,
    count:
      typeof value.count === "number" ? value.count : value.candidates.length,
  };
}

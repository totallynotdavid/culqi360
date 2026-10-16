import { asBoolean, asObject, asString, asStringArray } from "../shared.ts";

export type CanonicalContract = {
  fields: string[];
};

export type SourceContractEntry = {
  source_key: string;
  required_canonical_fields: string[];
  requires_any_phone_input: boolean;
};

export type SourceContract = {
  sources: SourceContractEntry[];
};

export type SourceManifestEntry = {
  source_key: string;
  mapping_path: string;
  enabled: boolean;
};

export type SourceManifest = {
  sources: SourceManifestEntry[];
};

export type SourceMapping = {
  fields: Record<string, string>;
  phone_columns: string[];
  phone_prefixes: string[];
};

export function parseCanonicalContract(raw: unknown): CanonicalContract {
  const root = asObject(raw, "canonical contract");
  return { fields: asStringArray(root["fields"], "canonical contract fields") };
}

export function parseSourceContract(raw: unknown): SourceContract {
  const root = asObject(raw, "source contract");
  const sourcesRaw = root["sources"];
  if (!Array.isArray(sourcesRaw)) {
    throw new Error("source contract sources must be an array");
  }

  const sources: SourceContractEntry[] = sourcesRaw.map((item, i) => {
    const row = asObject(item, `sources[${i}]`);
    const source_key = asString(row["source_key"], `sources[${i}].source_key`);
    const required_canonical_fields = asStringArray(
      row["required_canonical_fields"],
      `sources[${i}].required_canonical_fields`,
    );

    const requiresRaw = row["requires_any_phone_input"];
    const requires_any_phone_input =
      requiresRaw === undefined
        ? false
        : asBoolean(requiresRaw, `sources[${i}].requires_any_phone_input`);

    return { source_key, required_canonical_fields, requires_any_phone_input };
  });

  return { sources };
}

export function parseSourceManifest(raw: unknown): SourceManifest {
  const root = asObject(raw, "source manifest");
  const sourcesRaw = root["sources"];
  if (!Array.isArray(sourcesRaw)) {
    throw new Error("source manifest sources must be an array");
  }

  const sources: SourceManifestEntry[] = sourcesRaw.map((item, i) => {
    const row = asObject(item, `manifest.sources[${i}]`);
    const source_key = asString(
      row["source_key"],
      `manifest.sources[${i}].source_key`,
    );
    const mapping_path = asString(
      row["mapping_path"],
      `manifest.sources[${i}].mapping_path`,
    );
    const enabled = asBoolean(row["enabled"], `manifest.sources[${i}].enabled`);
    return { source_key, mapping_path, enabled };
  });

  return { sources };
}

export function parseSourceMapping(raw: unknown): SourceMapping {
  // Mapping files are pipeline-internal; we tolerate missing sections.
  const obj =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const fieldsRaw = obj["fields"];
  const fields: Record<string, string> = {};
  if (
    typeof fieldsRaw === "object" &&
    fieldsRaw !== null &&
    !Array.isArray(fieldsRaw)
  ) {
    for (const [k, v] of Object.entries(fieldsRaw)) {
      if (typeof v === "string") fields[k] = v;
    }
  }

  const phone_columns = Array.isArray(obj["phone_columns"])
    ? (obj["phone_columns"] as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];

  const phone_prefixes = Array.isArray(obj["phone_prefixes"])
    ? (obj["phone_prefixes"] as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];

  return { fields, phone_columns, phone_prefixes };
}

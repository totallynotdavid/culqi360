import {
  checkSearchContract,
  type LoadedSource,
} from "../src/search-contract/check.ts";
import {
  parseCanonicalContract,
  parseSourceContract,
  parseSourceManifest,
  parseSourceMapping,
} from "../src/search-contract/parse.ts";
import { parseProjectionSpec } from "../src/search-projection/parse.ts";
import { loadJson } from "../src/shared.ts";

const MANIFEST_PATH = "crates/pipeline/data/mappings/source-manifest.json";
const CANONICAL_PATH = "contracts/pipeline/canonical-contract.json";
const SOURCE_PATH = "contracts/pipeline/source-contract.json";
const DOC_PROJECTION_PATH = "contracts/engine/doc-projection.json";
const COMPANY_PROJECTION_PATH = "contracts/engine/company-projection.json";

const [
  manifestRaw,
  canonicalRaw,
  sourceRaw,
  docProjectionRaw,
  companyProjectionRaw,
] = await Promise.all([
  loadJson(MANIFEST_PATH),
  loadJson(CANONICAL_PATH),
  loadJson(SOURCE_PATH),
  loadJson(DOC_PROJECTION_PATH),
  loadJson(COMPANY_PROJECTION_PATH),
]);

const manifest = parseSourceManifest(manifestRaw);
const canonical = parseCanonicalContract(canonicalRaw);
const source = parseSourceContract(sourceRaw);
const docProjection = parseProjectionSpec(docProjectionRaw);
const companyProjection = parseProjectionSpec(companyProjectionRaw);

const enabledSources = manifest.sources.filter((s) => s.enabled);

const loaded: LoadedSource[] = await Promise.all(
  enabledSources.map(async (entry) => ({
    entry,
    mapping: parseSourceMapping(await loadJson(entry.mapping_path)),
  })),
);

const docResult = checkSearchContract(canonical, source, docProjection, loaded);
const companyResult = checkSearchContract(
  canonical,
  source,
  companyProjection,
  loaded,
);

if (!docResult.ok || !companyResult.ok) {
  const errors = [
    ...(docResult.ok ? [] : docResult.errors.map((e) => `[doc] ${e}`)),
    ...(companyResult.ok
      ? []
      : companyResult.errors.map((e) => `[company] ${e}`)),
  ];
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log([docResult.summary, companyResult.summary].join("\n"));

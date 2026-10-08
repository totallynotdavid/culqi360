# Contracts

JSON files in [`contracts/`](../contracts/) define the shapes that cross a
package boundary. [`tools/codegen/`](../tools/codegen/) turns the engine
contracts into checked-in Rust and TypeScript. Generated files are committed, so
Rust builds need no Bun and a fresh checkout needs no generation step.

## Engine contracts

| Contract                                   | Generated files                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `contracts/engine/record-api.json`         | `crates/leads/src/contracts_generated.rs`, `apps/web/src/contracts/engine/record-api.generated.ts`            |
| `contracts/engine/doc-projection.json`     | `crates/search/src/doc_projection_contract_generated.rs`                                                      |
| `contracts/engine/company-projection.json` | `crates/search/src/company_projection_contract_generated.rs`                                                  |
| Both projection contracts                  | `crates/search/src/result_contract_generated.rs`, `apps/web/src/contracts/search/engine-results.generated.ts` |

Edit the JSON, then run `bun run generate:contracts`. Do not edit the generated
files. `bun run check:contracts` regenerates in memory and fails when a
committed file differs.

## Pipeline contracts

`contracts/pipeline/canonical-contract.json` and `source-contract.json` are not
generated into code. The pipeline embeds them, and both engine projection
contracts, with `include_str!` in
[`contract_guard.rs`](../crates/pipeline/src/contract_guard.rs) and validates
its source mappings against them.

`bun run check:search-contract` checks, for every enabled source in
[`source-manifest.json`](../crates/pipeline/data/mappings/source-manifest.json),
that the source mapping, the canonical and source contracts, and both projection
contracts agree.

## Shared TypeScript constants

[`packages/contracts/`](../packages/contracts/) exports the extension bridge
types and status lists that the web application and the extension share.

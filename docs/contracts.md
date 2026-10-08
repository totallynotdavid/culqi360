# Contracts

JSON files in [`contracts/`](../contracts/) define the shapes that cross a
package boundary. [`tools/codegen/`](../tools/codegen/) turns the engine
contracts into checked-in Rust and TypeScript.

## Engine contracts

Edit the JSON under `contracts/engine/`, then run `bun run generate:contracts`.
Do not edit the generated files. `bun run check:contracts` regenerates in memory
and fails when a committed file differs. The docblock in
[`generate.ts`](../tools/codegen/bin/generate.ts) maps each contract to its
generated files.

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

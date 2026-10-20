# @crm/tsconfig

Shared TypeScript configuration. Every `tsconfig.json` in the repository extends
one of the two files here and keeps only what is specific to its package.

| File                       | Use for                                                   |
| -------------------------- | --------------------------------------------------------- |
| [`base.json`](base.json)   | Libraries, scripts and servers that do not touch the DOM. |
| [`solid.json`](solid.json) | Browser code and Solid components. Extends `base.json`.   |

`base.json` targets `ESNext` with `module: Preserve` and
`moduleResolution: bundler`, so imports resolve the way Vite, Bun and WXT
resolve them. It turns on `strict`, `noUncheckedIndexedAccess`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` and
`isolatedModules`, and sets `noEmit` because no package emits JavaScript with
`tsc`.

`solid.json` adds the DOM libraries and `jsx: preserve`. It leaves
`jsxImportSource` to the package: `apps/web` and `packages/images` use
`@solidjs/web` (Solid 2), and `apps/extension` uses `solid-js` (Solid 1).

## Use it in a package

Add the package as a development dependency, then extend a file:

```sh
bun add -d @crm/tsconfig@workspace:*
```

```json
{
  "extends": "@crm/tsconfig/base.json",
  "compilerOptions": { "types": ["bun"] },
  "include": ["src"]
}
```

A package keeps only paths, `include`, `types` and `jsxImportSource` in its own
file. `apps/extension` extends `solid.json` together with the configuration WXT
generates in `.wxt/tsconfig.json`.

Give the package a `typecheck` script:

```json
{ "scripts": { "typecheck": "tsc --noEmit" } }
```

## Type check

From the repository root:

```sh
mise run typecheck
```

It compiles the email templates, then runs `typecheck` in every workspace
package and type checks the scripts in [`tools/`](../../tools/) with
[`tools/tsconfig.json`](../../tools/tsconfig.json). `mise run check` runs it
before the lint and format checks.

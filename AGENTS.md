# Project guidelines

Readability

- Keep functions small, linear, and single-purpose.
- Use early returns to keep happy paths visible and indentation shallow.
- Avoid boolean mode arguments; split behavior into separate functions.
- Use one consistent domain term per concept across modules and APIs.
- Avoid generic names unless literal.
- Remove dead code, commented-out code, and ceremony without active value.
- Do not abstract coincidental similarity that has no shared reason to change.
- Keep side effects explicit and close to boundaries.
- Keep domain modules locally understandable without framework context.
- Validate at boundaries and return explicit errors with actionable context.
- Comments are allowed only for non-obvious intent or external API quirks.
- Long comments are welcome when they record _why_, a measured result, a
  rejected alternative, an external quirk, so a future maintainer keeps the
  reasoning. Cut comments that only restate the code.

Working approach

- Be pragmatic about the architecture, not about the diff. "Pragmatic" means the
  shape that is right for the long term, not "keep the debt to stay small."
- Breaking changes are encouraged when they buy long-term clarity. The DB is
  disposable (reset/reseed freely); there is no backfill or compat-shim burden.
- Verify, don't guess. A throwaway probe script beats an assumption.
- Give each cross-cutting invariant one owner instead of re-checking it at every
  call site.

## ALWAYS

- Prefer retrieval-led reasoning over pre-training for libraries/frameworks. Use
  MCP context7 for current docs before writing code.
- Follow framework conventions. Do not invent workarounds.
- Push back when a request conflicts with conventions, correctness, safety, or
  maintainability. Explain the concern and choose the cleanest defensible path.
- Prefer explicit, straightforward code over clever abstractions.
- State what you verified vs what you're inferring. If uncertain about line
  numbers or API details, say so.

## WHEN implementing

- Make one change at a time.
- After edits, briefly state what changed, where, and what validation was
  performed.
- Provide brief progress updates only when starting major work phases or plan
  changes.
- Apply fail-fast: validate inputs → auth checks → business logic.
  - Check "not OK" first to avoid nesting.
  - Early return or throw immediately for invalid states.
  - Keep the happy path as straight-line code at the end.
- For TypeScript services, return `Result<T,E>` and check `isErr()` before throw
  or return.
- For Rust handlers and services, validate early and propagate failures with
  `?`.
- Implement the intended design fully. Do not stop at scaffolding, placeholder
  phases, or partial rewrites.
- After implementation, reread touched files and confirm the work is complete,
  coherent, and free of temporary compatibility code, duplicate paths, and
  partial renames.
- When a change is behaviorally testable or crosses boundaries, run the smallest
  direct test or probe before finalizing. If it is not directly testable, say
  why and use the best available static check.
- Validate by scope:
  - Docs or instruction changes: reread links, file references, commands, and
    generated indexes. Do not run full repo checks unless behavior changed.
  - Broad refactors or redesigns: finish the design first, then run the relevant
    checks at the end.
  - Run `bun run check` only for cross-subsystem changes, generation or contract
    changes, or repo-wide tooling changes.
- Use `bun run test` for Vitest-based tests. Do not use `bun test`.

## WHEN checking UI changes live

- Use `bun run preview --role <role>` (or `--as <username>`) to get an
  authenticated URL + session cookie, then drive it with `bunx agent-browser`.
  Never hand-roll a dev server or the login form for this.

## WHEN adding dependencies

- `bun install <package>` to add packages.
- Never manually edit package.json dependency versions.
- Look up current API via context7 if unfamiliar.

## WHEN writing TypeScript

1. Read the touched code path and extract types from existing repo or service
   returns before introducing new types.
2. Validate external or untrusted data at the boundary. Use `unknown` first,
   then narrow with type predicates.
3. Keep service-layer failures in `Result<T,E>`. Check `isErr()` before throw or
   return.
4. Use `Pick<T, K>`, `Omit<T, K>`, `Partial<T>`, `as const`, and `satisfies` to
   preserve inference instead of rebuilding shapes manually.
5. End union or enum `switch` statements with `satisfies never`.

Failure points:

- Duplicating a type that can be inferred from an existing function.
- Treating parsed JSON, form data, or caught errors as trusted data.
- Throwing a service-layer failure that should stay in `Result<T,E>`.

### WHEN editing types

1. Start with a discovery pass before any type refactor.
   - List candidate types in touched files.
   - List current import paths across `apps/web/src/server`,
     `apps/web/src/actions`, and `apps/web/src/features`.
2. Run usage-count checks only for discovered candidates. Do not guess ownership
   before enumeration.
   - Count references per candidate type with `rg -n "\\bTypeName\\b" <scope>`.
   - For web slices, use `<scope>` =
     `apps/web/src/server apps/web/src/actions apps/web/src/features`.
   - Keep in contracts only if used by multiple files across boundaries
     (`server`, `actions`, `features`).
   - Keep local if used in one file or one boundary.
   - Inline in a signature when the shape is small and one-off.
3. Default to local changes, but escalate to structural refactor when the root
   cause crosses boundaries or creates duplicated ownership.
4. Do not keep temporary compatibility ownership unless explicitly requested.
5. Avoid re-export type indirection. Import types directly from their canonical
   owner.

## WHEN writing SolidJS

Anti-patterns to check before implementing:

- Props destructuring breaks reactivity. Use `props.value`, not
  `const { value } = props`.
- Components run once, not on every update. Signals drive updates.
- Signals are functions. Access with `count()`, not `count`.
- Use `<For>` for reference-keyed objects and `<Index>` for primitive lists.
- Side effects belong in `createEffect` or `onMount`, never during render.
- Nest `<Errored>` _inside_ `<Loading>`, never outside. A read that rejects
  while the pending boundary is still waiting never reaches an error boundary
  placed outside it: neither fallback renders and the subtree comes out empty.
  Measured on `/settings/data-sources` with the engine unreachable.
- Never write an effect whose only job is resetting state when a key changes.
  `createSignal(fn)` is a _writable memo_: it recomputes (and so resets) when
  its dependencies change, and takes local writes in between. That is the
  primitive for a draft seeded from a prop, a pagination trail scoped to a
  filter, or a flag scoped to the value it was raised for.
- A DOM node an effect depends on belongs in a signal, not a `ref` variable. A
  plain `let` is invisible to the effect, so it cannot re-run once the node
  exists.

## Standards

- Naming: kebab-case.ts, camelCase vars, PascalCase types, UPPER_SNAKE_CASE
  constants.
- Organization: 70-line guideline, not a hard rule. Single responsibility. If
  "and also" appears in the description, split it. Code as documentation.
  Comments only for non-obvious decisions or JSDoc.
- Use descriptive test names such as
  `it("blocks further attempts after repeated failures")`.

## Comment style guide

Write comments for future maintainers with operational intent.

Keep comments:

- Direct, concrete, and behavior-focused.
- Close to the logic they explain.
- Focused on non-obvious decisions, invariants, edge cases, and boundary
  contracts.

Avoid comments that:

- Repeat obvious code structure (`Header`, `Info`, `Poster`).
- Repeat cross-module rationale already documented here.
- Use meta narrative about the writing process.

Style constraints:

- Prefer plain sentences with periods, commas, parentheses, and brackets.
- Avoid em dashes.
- Use doc comments for exported APIs when the contract is subtle.

### Rules for better code review

1. Do not abstract by default. Extract helpers only when they remove meaningful
   duplication or clarify intent. Avoid helpers that force the reader to jump
   around for a 3-line transformation.
2. Keep transformations near their boundary. If a command expects a smaller
   shape, project it inline. Do not pass a larger object just because TypeScript
   allows structural compatibility.
3. Normalize once, then use the normalized value. Do not compute
   `const normalizedRuc = input.ruc.trim()` and later call `input.ruc.trim()`
   again.
4. Extract repeated validation only when it represents a real concept.
5. Prefer explicit object construction at domain boundaries. When calling
   workflow/domain commands, explicit payloads are safer and easier to audit
   than blindly spreading large objects.

6. Use spreads only when the input shape is intentionally the command shape.
7. Remove dead or unused fields/imports. If x is present in an input type but
   unused, question whether it belongs there.
8. Simplify callbacks when they are pure pass-throughs. Prefer:

```ts
(input) => querySomething(input);
```

over unnecessary `async` blocks with `return`.

12. Let formatting improve scanability. Add blank lines between parse, error
    handling, mutation, revalidation, and cleanup. This often beats adding
    abstractions.
13. Do not fight the type system with invented local types.
14. In UI code, extract repeated markup only when it reduces visual noise. For
    example, a `TextFieldRow` is useful if it removes many repeated rows. Do not
    extract every label, radio, or button into a component automatically.

### Questions an agent should ask while reviewing

1. Does this code pass a larger object than the callee needs?
2. Is this helper making the code easier to read, or just shorter?
3. Can validation happen before the async/runtime/action boundary?
4. Is `execute` doing more than executing?
5. Are names describing the current value accurately?
6. Is this value normalized once and reused consistently?
7. Is `...input` safe here, or could it leak extra fields across a boundary?
8. Is duplicated code accidental duplication or a meaningful repeated concept?
9. Would extracting this make future changes safer, or just add indirection?
10. Are TypeScript types coming from the domain, or am I guessing them?\*\*
11. Would a reader understand this flow top-to-bottom without jumping around?
12. Is the current code already fine?

That last question matters. BE comfortable saying: "No meaningful change
needed."

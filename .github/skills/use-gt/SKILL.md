---
name: use-gt
description:
  "Use Graphite CLI for branch stacks and pull requests in this repo. Use when
  creating commits, updating stacked branches, submitting PRs, syncing with
  trunk, or merging. Covers required commands, signed commit expectations, and
  forbidden shortcuts such as disabling verification."
---

## good path

1. Check `git status --short --branch` and `gt state` first.
2. If `HEAD` is detached, stop. Check out the intended branch before using `gt`.
3. Write code first, then stage with `git add`.
4. Create the branch with `gt create`.
5. Update existing stack branches with `gt modify`.
6. Publish non-draft PRs with `gt submit --publish --no-interactive`.
7. Merge from the top stack branch with `gt merge --no-interactive`.
8. Run `gt sync` after merge.

## rules

- Use `gt create` instead of `git commit`.
- Use `gt submit` instead of `git push` for PR branches.
- Do not pass `--no-verify`.
- Do not disable GPG signing or hook verification.
- If signing or hooks fail, stop and fix the environment or ask the user.

## failure patterns to avoid

- Detached `HEAD` causes `gt create` to fail.
- Draft PRs cause `gt merge` to fail until they are published.
- Merging without checking `gt state` hides stack problems.
- Manual Git history changes make stack state harder to reason about.

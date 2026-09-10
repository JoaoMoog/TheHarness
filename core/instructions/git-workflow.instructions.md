---
applyTo: "**"
excludeAgent: [specifier, planner, tasker]
description: Commit, branch and pull request conventions, including the operations that require explicit human instruction.
---

# Git workflow

## Commits

Conventional commit format, subject in the imperative, no trailing period:

```
<type>: <subject>

<body: why, not what>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `build`.

One logical change per commit. If the subject needs "and", split it. The body
explains the reason the change was necessary; the diff already shows what moved.

## Branches

Work on a branch, never directly on the default branch. Name it
`<type>/<short-description>`.

## Pull requests

Describe the change against the whole branch, not the last commit — read
`git diff <base>...HEAD`. Include what changed, why, and how it was verified.
List anything intentionally left out.

## Never without an explicit instruction

- `push --force` or `push --force-with-lease` to a shared branch
- `reset --hard` when uncommitted work exists
- history rewrites: `rebase` on pushed commits, `filter-branch`, amend on a
  pushed commit
- deleting a branch that is not merged
- `commit --no-verify`, which is exactly the guardrail bypass the hooks exist to
  prevent

Any of these on request: confirm the target and say what will be lost first.

## Before committing

The pre-commit guardrails run automatically when the harness is installed. They
refuse files that must not enter history, and they warn about credential-shaped
values without refusing the commit, recording each warning in
`.harness/secrets.log`. A warning is not a pass: a value that reaches history is
compromised and must be rotated, so fix the cause before pushing — do not reach
for `--no-verify`. A false positive is marked once, with the id the warning
prints: `harness secrets --allow=<id> --why="<reason>"` writes the committed
`.harness-allow.json` and the scan stays quiet about that value everywhere.

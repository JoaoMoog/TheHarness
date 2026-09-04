---
name: ado-comment
description: Leave review findings on an Azure DevOps pull request as one anchored thread per finding, instead of a single wall of text. Use when commenting on a PR.
version: 1.0.0
sfa: "scope: one pull request | format: one anchored comment thread per finding | audience: the author of the change"
stacks: []
alwaysApply: false
---

# ado-comment

## Rules

One thread per finding, anchored to the file and line it is about. A single
comment listing eight problems cannot be resolved, cannot be replied to
individually, and forces the author to hold all eight in their head at once.

Every thread carries the concrete failure: the input or state, and the wrong
result it produces. `code-review` already defines what makes a finding real -
this skill is about placing it, not about judging it. A finding that cannot be
made concrete does not become a comment.

Say what to change. A comment that names a problem without a direction turns
into a conversation that costs more than the fix.

Severity goes in the first word, so the author can triage the list without
opening each one: blocker, major, minor, nit.

Resolve only what you opened and can verify is addressed. Resolving someone
else thread, or one you did not check, removes a signal the team relies on.

Anti-patterns to refuse:

- one thread with a numbered list of findings
- a comment on a line the change did not touch, unless that line proves the
  change is wrong
- restating what the code does
- a nit thread on a PR that also has a blocker; fix the blocker first and say
  the nits are optional

## Workflow

1. Take the findings from the review phase, already ranked.
2. Drop anything without a concrete failure scenario.
3. If there is a blocker, comment on that first and say plainly that the rest
   are optional until it is resolved.
4. For each remaining finding, open one thread anchored to its file and line:
   `node .github/tools/ado/pr-comment.mjs --pr=<id> --file=<path> --line=<n> --content-file=<path>`
5. Use `--content-file` whenever the text has more than one line, so nothing
   free-form travels on the command line.
6. Report how many threads were opened and their severities.

## Output

```
blocker: offset uses page * size, so page=1 skips the first 20 rows.

    getOrders({ page: 1, size: 20 })

returns rows 21-40 and the first page is unreachable. Pagination is 1-based at
the boundary, so the offset needs (page - 1) * size.
```

Reported back as:

```
4 threads opened on PR 482
  1 blocker  src/api/list.ts:42
  2 major    src/api/list.ts:58, src/api/guard.ts:12
  1 nit      src/api/list.ts:71   (optional until the blocker is resolved)
```

## Validation

- [ ] One thread per finding, each anchored to a file and line.
- [ ] Every thread states a concrete failure and a direction for the fix.
- [ ] Severity is the first word of each thread.
- [ ] Multi-line content went through a file, not the command line.
- [ ] No thread was resolved that this session did not open and verify.
- [ ] The count and severities were reported back.

---
name: traceability
description: Link every requirement to a test through stable ids, and read the matrix that exposes unverified intent and unrequested behaviour. Use when writing specs, writing tests, or preparing a pull request.
version: 1.0.0
sfa: "scope: one specification and its tests | format: id-tagged tests plus the matrix | audience: the reviewer deciding whether the change does what was asked"
stacks: []
alwaysApply: false
---

# traceability

## Rules

An id is a promise. `FR-001` in the spec, `FR-001` in the test name, `FR-001` in
the matrix: that chain is the only mechanical proof that what was asked for is
what was built.

Ids are stable forever. Renumbering after approval breaks every trace pointing
at the old number, silently. A deleted requirement leaves its id retired, never
reused.

The matrix exists to expose exactly two things, and neither is visible in a diff:

- **A requirement with no test** is unverified intent. Someone wrote down what
  the system must do and nobody proved it does.
- **A changed file no requirement asked for** is unrequested behaviour. It may
  be fine, but it was not part of what was approved, so it needs a sentence.

A test claims an id by naming it in the test name. Put it first, so a failing
run says which requirement broke without anyone opening the file.

Never weaken a test to close a gap. The spec is read-only ground truth during
implementation; if a requirement turns out untestable as written, that is a
finding for the specify phase, not something to edit around.

Anti-patterns to refuse:

- one test named after five requirements
- an id in a comment but not in the test name, so a failure does not name it
- closing a gap by deleting the requirement
- a requirement whose text is so vague that any test would satisfy it

## Workflow

1. When writing the spec, give every criterion an id. `FR-` for functional,
   `NFR-` for the rest. Mark anything ambiguous as
   `[NEEDS CLARIFICATION: question]` instead of choosing.
2. When writing tests, put the id first in the test name.
3. Before opening the pull request, run the matrix:
   `node .github/tools/spec/traceability.mjs --spec=specs/<id>-<slug> --base=main`
4. For each `GAP`, either write the missing test or explain in the pull request
   why the requirement is out of scope for this change.
5. For each unrequested file, either link it to a requirement or say why it had
   to change.
6. Paste the matrix into the pull request body. The reviewer question shifts
   from "does this look right" to "does this satisfy the spec", which has an
   answer.

## Output

```
it("FR-002 writes a header-only file when the filter matches nothing", ...)
```

```
| requirement | tests | status |
|---|---|---|
| FR-001 | tests/export.spec.ts | PASS |
| FR-002 | tests/export.spec.ts | PASS |
| FR-003 | MISSING | GAP |

  FR-003    unverified intent: WHILE an export is running, disable the button
    -       src/telemetry.ts changed, and no requirement asked for it

  2 of 3 requirements verified
```

## Validation

- [ ] Every requirement in the spec has an id, and no id was renumbered.
- [ ] Every test names the id it covers, first in the test name.
- [ ] The matrix was run and its output is in the pull request body.
- [ ] Every GAP is either closed or explained.
- [ ] Every unrequested file is either linked to a requirement or explained.
- [ ] No question is still marked NEEDS CLARIFICATION.

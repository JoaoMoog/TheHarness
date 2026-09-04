---
name: ado-pull-request
description: Compose the body of an Azure DevOps pull request so a reviewer can judge it without reading the whole session, and open it as a draft first. Use in the deliver phase or when asked to open a PR.
version: 1.0.0
sfa: "scope: one pull request | format: a PR body plus the script invocation | audience: the reviewer who has not seen the session"
stacks: []
alwaysApply: false
---

# ado-pull-request

## Rules

The reviewer did not watch the session. The body is the only thing carrying the
reasoning across, so it answers four questions - what changed,
why, what was actually verified, and what was deliberately left out - and
carries the traceability matrix, because the reviewer question is not "does this
look right" but "does this satisfy the spec", which only the matrix answers.

Draft first, always. A draft costs nothing to correct; a published PR has
already notified reviewers and started branch policies. Publishing is a separate
decision and a separate quadrant.

Never restate the diff. The reviewer can read it. Write the part the diff cannot
show: the constraint that made the obvious approach wrong, the alternative that
was rejected, the criterion that turned out to be untestable as written.

Verification is reported as it happened. `tests: not-run` is an acceptable line.
A claimed pass that did not run is a false report, and the reviewer will trust
the next one less.

Link the work items rather than describing them, and keep the title in the
commit convention that `commit-and-pr` already defines - that skill owns the
message format, and repeating it here would let the two drift apart.

Anti-patterns to refuse:

- a body that is a bullet list of changed files
- opening a PR from a session whose review phase did not return approve or
  approve-with-comments
- a title that says "changes" or repeats the branch name
- pasting the whole review verdict, including the nits, into the description

## Workflow

1. Read the session file for the feature, the decisions and the open questions.
2. Take the verdict and the verified block from the review phase. If review did
   not run, stop: there is nothing to open a PR for yet.
3. Write the body to `specs/<id>-<slug>/pr-body.md`, following the template
   below. Keep it under a screen.
4. Open it as a draft:
   `node .github/tools/ado/pr-create.mjs --title="<conventional title>" --description-file=specs/<id>-<slug>/pr-body.md`
5. Read the returned url back to the user with the PR id.
6. Publishing is a separate step and needs a human yes. Offer it; do not do it.

## Output

```markdown
## What
Export the saved report as CSV from the report toolbar.

## Why
Finance re-keys these numbers into a spreadsheet every month. The filter set is
what they need, not the whole table, which is why the export follows the active
filter rather than the underlying query.

## Traceability
| requirement | tests | status |
|---|---|---|
| FR-001 | tests/export.spec.ts | PASS |
| FR-002 | tests/export.spec.ts | PASS |

## Verified
- npm test: 214 passing, 0 failing
- Six acceptance criteria, each with a test: specs/007-export-csv/spec.md
- Manually checked the empty result and the permission-denied paths

## Out of scope
Scheduled exports and XLSX. Both were raised and deferred; see the decisions in
specs/007-export-csv/session.md.

Work items: #4821
```

## Validation

- [ ] The four questions are answered, and the traceability matrix is in the body.
- [ ] Every GAP in the matrix is either closed or explained.
- [ ] The verified section reports what actually ran, failures included.
- [ ] The PR was opened as a draft.
- [ ] The title follows the convention in `commit-and-pr`.
- [ ] The url and the PR id were reported back.
- [ ] Publishing was offered as a choice, not performed.

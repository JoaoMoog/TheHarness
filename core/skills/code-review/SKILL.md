---
name: code-review
description: Review a change set for correctness and maintainability, producing ranked findings each backed by a concrete failure scenario. Use when reviewing a diff, a branch or a pull request.
version: 1.0.0
sfa: "scope: one change set | format: ranked findings with failure scenarios | audience: the engineer who wrote it"
globs: []
stacks: []
alwaysApply: false
---

# code-review

## Rules

Review in this order and stop escalating once a blocker is found: correctness,
then contract violations, then error handling, then tests, then clarity. A style
opinion never outranks a wrong result.

Every finding names a concrete scenario - specific input or state, and the wrong
output or crash it produces. A finding you cannot make concrete is a preference;
say so or drop it.

Read the surrounding code before judging the diff. A pattern that looks wrong in
isolation is often the convention of the file.

Review the change, not the file. A finding points at lines the change
introduced or altered, or at behaviour they produce. A problem that predates
the change - in a touched file or anywhere else - is a `warn`: location,
problem, suggested improvement, one line. It never moves the verdict, and it is
never fixed as part of this review.

Before flagging missing error handling, find the mechanism the application
already has: middleware, filters, global handlers, a wrapping decorator. A
handler that mechanism covers is not a finding.

A re-review after request-changes starts from the previous findings and the
diff since then. Each finding is confirmed closed or open, only the new lines
are read, the deterministic checks run once, and a new finding needs new
evidence. What was approved last time is not read again.

Anti-patterns to refuse:

- restating what the code does as if it were a finding
- listing every nit at the same weight as a real defect, which buries it
- demanding a rewrite in the reviewer preferred style
- approving code you could not read, or claiming tests pass without running them
- blocking on a problem the change did not introduce
- re-reviewing an unchanged diff, or re-running checks that already passed on
  the same tree state

## Workflow

1. Read the requirement the change claims to satisfy. Without it you can only
   check internal consistency, so say that explicitly.
2. Read the full diff against the base branch, not just the last commit. On a
   re-review, read the previous findings and the diff since that review.
3. For each changed file, open enough surrounding code to judge intent, and to
   know which problems were already there.
4. Run the build, lint and test commands the repository defines, once, on the
   current tree. Record the real result, the tree state
   (`node .github/tools/verify/tree-state.mjs`), and every failure.
5. Collect findings, each with a failure scenario. Classify each as introduced
   by the change or pre-existing; pre-existing becomes `warn`. Discard any you
   cannot make concrete.
6. Rank by severity and write the verdict.

## Output

```
verdict: request-changes
summary: Pagination is off by one at the last page and the new branch is untested.

findings:
  - severity: blocker
    file: src/api/list.ts:42
    claim: offset uses page * size instead of (page - 1) * size
    scenario: page=1,size=20 skips the first 20 records and returns rows 21-40
    fix: offset = (page - 1) * size

  - severity: minor
    file: src/api/list.ts:58
    claim: the empty-result branch has no test
    scenario: a filter matching nothing returns undefined instead of []
    fix: add a case asserting an empty array

  - severity: warn
    file: src/api/orders.ts:88
    claim: getOrder swallows the repository error and answers 200 with an empty body
    scenario: pre-existing - the repository throws and the client is told it succeeded
    fix: out of scope for this change; let it propagate to the error middleware

verified:
  on: a1b2c3d+9f8e7d6c
  build: pass
  tests: fail - 2 failing in list.spec.ts
```

## Validation

- [ ] Every finding has a concrete failure scenario, not a description.
- [ ] Severity reflects impact, not how easy the fix is.
- [ ] The verified block reports commands that actually ran, and the tree state;
      not-run is used honestly rather than assuming a pass.
- [ ] Nothing outside the change set was reviewed unless it proves the change
      wrong.
- [ ] No blocker or major points at code the change did not introduce or alter;
      those are `warn`, with location, problem and suggested improvement.
- [ ] On a re-review, only the delta and the previous findings were read, and
      the checks ran once.
- [ ] If the change was too large to review properly, that is the verdict.

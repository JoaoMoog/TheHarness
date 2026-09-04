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

Anti-patterns to refuse:

- restating what the code does as if it were a finding
- listing every nit at the same weight as a real defect, which buries it
- demanding a rewrite in the reviewer preferred style
- approving code you could not read, or claiming tests pass without running them

## Workflow

1. Read the requirement the change claims to satisfy. Without it you can only
   check internal consistency, so say that explicitly.
2. Read the full diff against the base branch, not just the last commit.
3. For each changed file, open enough surrounding code to judge intent.
4. Run the build, lint and test commands the repository defines. Record the real
   result, including failures.
5. Collect findings, each with a failure scenario. Discard any you cannot make
   concrete.
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

verified:
  build: pass
  tests: fail - 2 failing in list.spec.ts
```

## Validation

- [ ] Every finding has a concrete failure scenario, not a description.
- [ ] Severity reflects impact, not how easy the fix is.
- [ ] The verified block reports commands that actually ran; not-run is used
      honestly rather than assuming a pass.
- [ ] Nothing outside the change set was reviewed unless it proves the change
      wrong.
- [ ] If the change was too large to review properly, that is the verdict.

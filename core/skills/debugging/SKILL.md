---
name: debugging
description: Reproduce a defect as a failing test, then find its cause by testing one falsifiable hypothesis at a time instead of changing code speculatively. Use for any bug, test failure or unexpected behaviour.
version: 1.0.0
sfa: "scope: one failure | format: a reproduction test plus a hypothesis log ending in a root cause | audience: the engineer fixing it"
stacks: []
alwaysApply: false
---

# debugging

## Rules

No fix before a reproduction. A change that makes a symptom disappear without a
test proving the cause is a guess with a commit message attached.

The reproduction is a test in the repository suite, not a manual sequence of
steps. Manual steps are how you find it; a test is how it stays fixed. It must
fail for the reported reason: a test that fails because of a typo in the test
proves nothing.

Minimal means minimal. Strip every input, dependency and branch the failure does
not need. A reproduction that requires the whole application has not been
narrowed yet.

One hypothesis at a time, each falsifiable by an observation you can actually
make. Changing three things and seeing the symptom vanish tells you nothing
about which one mattered.

Separate the symptom from the cause. A null at line 90 is a symptom; the code at
line 30 that failed to populate it is the cause. Fixing line 90 moves the bug
rather than removing it.

Anti-patterns to refuse:

- changing code until the symptom stops, then writing a test that agrees
- reproducing only in a debugger or a scratch script
- adding a null check or widening a catch as the fix, without knowing why the
  value was null
- calling it fixed because a retry made it pass

## Workflow

1. Restate the defect as expected versus actual, with the concrete input.
2. Reproduce it manually once, to confirm the report is accurate.
3. Narrow it: remove inputs and layers until the smallest thing that still fails.
4. Write that as a test in the suite. Run it. Confirm it fails for the reported
   reason.
5. Write the smallest hypothesis that would explain everything observed.
6. Design the cheapest observation that would prove it false: one log at one
   boundary, one assertion, one breakpoint. Run it.
7. If the hypothesis survives, narrow it. If it dies, write the next one.
8. State the root cause in one sentence, then fix the cause.
9. Run the full suite and report the real result.

## Output

```
Expected: getUser("") rejects with ValidationError
Actual:   getUser("") queries with an empty id and returns the first row

Reproduction: test/users.spec.ts "rejects an empty id"
Status before the fix: failing, for the reported reason

H1: the id guard checks undefined but not the empty string
  observation: log the guard input at the boundary
  result: confirmed, "" reaches the query

Root cause: the guard uses a truthiness check, and "" is falsy in the wrong
direction for this API, which treats an empty id as "no filter".
Fix: reject at the boundary with an explicit length check.
Suite after: 214 passing.
```

## Validation

- [ ] A test in the suite reproduces the defect.
- [ ] That test was observed failing before the fix, for the reported reason.
- [ ] The reproduction is minimal.
- [ ] Each hypothesis was recorded and either confirmed or falsified.
- [ ] The stated root cause explains every symptom observed.
- [ ] The fix addresses the cause, not the symptom.
- [ ] The full suite result is reported, failures included.

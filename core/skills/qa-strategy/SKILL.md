---
name: qa-strategy
description: Decide where testing effort actually pays, and find coverage gaps that matter rather than the ones a percentage reports. Use when planning tests for a feature or auditing a suite.
version: 1.0.0
sfa: "scope: one feature or one suite | format: a ranked list of what to test and what not to | audience: whoever is deciding where the testing hours go"
stacks: []
alwaysApply: false
---

# qa-strategy

## Rules

Coverage percentage measures lines executed, not behaviour verified. A suite can
execute every line and assert nothing. Treat the number as a floor for noticing
untouched areas, never as evidence that anything works.

**Spend the effort where a defect is expensive and the behaviour is uncertain.**
Money, permissions, data loss and anything that a user cannot undo earn deep
testing. A settings toggle does not, however easy it is to test.

Test at the cheapest level that can actually catch the defect. A rule about
rounding belongs in a unit test; a rule about two services agreeing does not,
and unit tests with mocks on both sides will pass while production disagrees.

**The gaps that matter are the branches nobody wrote:** the empty result, the
permission denied, the timeout, the duplicate submit, the maximum size, the
concurrent edit. A suite that only covers the happy path has high coverage and
no protection.

One assertion subject per test. A test that checks six things reports one
failure and hides five.

Anti-patterns to refuse:

- raising a coverage number by testing getters
- an end-to-end test for a rule a unit test would pin down
- mocking the thing under test
- a test whose name does not say what breaks when it fails

## Workflow

1. List the behaviours from the requirement ids, not from the code. The code
   tells you what exists, not what was asked for.
2. Rank them by cost of failure times uncertainty. Test the top of that list
   deeply and the bottom shallowly.
3. Pick the level for each: unit for logic, integration for a boundary between
   things you own, contract for a boundary you do not own, end to end only for
   the handful of paths where a whole journey has to hold.
4. For each behaviour, write the boundary cases explicitly: empty, one, many,
   maximum, denied, slow, duplicated.
5. Check the suite for the gaps that matter, not the lines that are red.
6. Say what is deliberately not tested, and why.

## Output

```
Feature: CSV export   (FR-001..FR-006)

deep, unit           FR-002 empty filter produces header only
                     FR-005 permission denied returns 403 before touching data
deep, integration    FR-001 the export follows the active filter, against a real db
shallow, unit        FR-003 the button disables while running
not tested           FR-004 the column order matches the table
                     reason: cosmetic, and the table order is already tested

gaps found in the existing suite
  no test asserts behaviour above 10000 rows, and NFR-001 sets a limit there
  every provider call is mocked on both sides; nothing proves the contract
```

## Validation

- [ ] The behaviour list came from requirement ids, not from reading the code.
- [ ] Effort is ranked by cost of failure times uncertainty.
- [ ] Each behaviour is tested at the cheapest level that could catch it.
- [ ] Boundary cases are named explicitly, not implied.
- [ ] What is deliberately untested is written down with a reason.
- [ ] No claim rests on a coverage percentage.

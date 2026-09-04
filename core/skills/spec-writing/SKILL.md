---
name: spec-writing
description: Turn a feature request into acceptance criteria in EARS syntax that are individually testable, including the unwanted-condition cases. Use in the specify phase, before any planning or code.
version: 1.0.0
sfa: "scope: one feature request | format: a spec.md with numbered EARS criteria | audience: the planner and whoever reviews the spec"
stacks: []
alwaysApply: false
---

# spec-writing

## Rules

Every requirement carries a stable id: `FR-001` for functional, `NFR-001` for
everything else. The id is never renumbered after approval, because a test and a
commit will point at it. The traceability tool only recognises these two
prefixes; any other numbering is invisible to the matrix.

An ambiguity is written as `[NEEDS CLARIFICATION: the question]`, never resolved
by a quiet assumption. The phase does not close while one is open.

A criterion that cannot be turned straight into a test is not finished. Rewrite
it until it can. "The system should be fast" is not a criterion; "WHEN a user
submits the form, the system SHALL respond within 200 ms at p95" is.

Use one of the six EARS patterns for every criterion, so the trigger and the
obligation are explicit:

| pattern | shape |
|---|---|
| Ubiquitous | The system SHALL ... |
| Event | WHEN <trigger>, the system SHALL ... |
| State | WHILE <state>, the system SHALL ... |
| Optional | WHERE <feature is present>, the system SHALL ... |
| Unwanted | IF <condition>, THEN the system SHALL ... |
| Complex | WHEN <trigger>, IF <condition>, THEN the system SHALL ... |

Write the unwanted-condition cases. A spec with only happy paths produces an
implementation with only happy paths, and the gap is discovered in production.

Write the anti-goals: what this feature deliberately does not do. A reader
cannot tell an omission from an oversight unless you say which it is.

An ambiguity where two readings produce materially different systems is an open
question, not a choice to make quietly. Record it and stop.

Anti-patterns to refuse:

- proposing a solution, a schema or a file layout; that is the planner's job
- criteria that restate the request in different words
- "and" joining two obligations in one criterion
- an acceptance criterion with no observable outcome

## Workflow

1. Restate the request in one sentence, and name who is worse off today.
2. Write the goal: what is true when this is done that is not true now.
3. Write the anti-goals.
4. Write the criteria, numbered FR-001 upward, one EARS pattern each.
5. Add the unwanted-condition cases: empty, missing, unauthorised, too large,
   already exists, downstream unavailable.
6. Add non-functional constraints as numbers, not adjectives.
7. List the open questions. If any would change the shape of the result, stop
   and escalate rather than assuming.

## Output

```
## Goal
Users can export the current filtered view as CSV without waiting for a job.

## Anti-goals
No scheduled exports. No formats other than CSV. No export of unfiltered tables.

## Acceptance criteria
FR-001  WHEN a user requests an export, the system SHALL return a CSV of exactly
       the rows matching the active filter.
FR-002  IF the filtered result exceeds 50,000 rows, THEN the system SHALL refuse
       with a message naming the limit.
FR-003  IF the user lacks read permission on any column in the view, THEN the
       system SHALL omit that column and record the omission in the audit log.
FR-004  The system SHALL respond within 3 seconds at p95 for 10,000 rows.

## Open questions
[NEEDS CLARIFICATION: Must the file name include the tenant? This changes the storage path.]
```

## Validation

- [ ] Every criterion uses one EARS pattern and is individually testable.
- [ ] At least one unwanted-condition criterion exists.
- [ ] Anti-goals are stated.
- [ ] Non-functional constraints are numbers.
- [ ] No solution, schema or file layout appears anywhere.
- [ ] Open questions are listed, and the session stops if one is blocking.

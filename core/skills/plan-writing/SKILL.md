---
name: plan-writing
description: Turn an approved spec into an implementation plan that names the files, the contracts, the order of work and the risks, after searching for what already exists. Use in the plan phase, before any code.
version: 1.0.0
sfa: "scope: one approved spec | format: a plan.md with files, order and risks | audience: the tasker and the reviewer"
stacks: []
alwaysApply: false
---

# plan-writing

## Rules

Search before you propose. Reuse of something that already exists beats a
parallel implementation, and finding nothing is a result worth writing down
because it tells the reviewer the search happened.

Every step leaves the repository building with its tests passing. A plan whose
middle steps require a broken tree cannot be reviewed incrementally and cannot
be abandoned halfway.

Name the files. A plan that says "update the service layer" cannot be checked
against the diff; a plan that names four files can.

State the rejected alternative and why. A plan with no rejected option was not a
decision, it was a default.

Risks are specific and have a mitigation. "Might break something" is not a risk;
"the migration locks the orders table for the duration, which at production row
counts is minutes" is.

Anti-patterns to refuse:

- writing code in the plan phase
- a plan that only restates the spec as a task list
- a step that touches auth, crypto, payment or data destruction without being
  flagged for human approval
- speculative generality: interfaces for a second implementation nobody asked for

## Workflow

1. Read the spec and the repository context file if one exists.
2. Search for existing functions, modules and utilities that already do part of
   this. Record what you found and what you will reuse.
3. Choose the approach. Write down the obvious alternative and why it loses.
4. List every file to create or change, with what changes in each.
5. Define the contracts this introduces or alters, and mark any that break an
   existing consumer.
6. Order the work so each step is independently green.
7. List the risks, each with a mitigation.
8. Flag every step that needs human approval before it runs.
9. Describe how the finished result is verified end to end.

## Output

```
## Approach
Stream the CSV from the existing query builder rather than materialising it,
because the row cap is high enough that buffering would hold tens of megabytes
per request. Rejected: a background job with a download link, which adds storage
and a second failure mode for a case that finishes in seconds.

## Reuse found
- src/query/filter.ts buildFilter() already turns the UI filter into SQL.
- src/http/stream.ts has the chunked response helper.
- Nothing exists for CSV encoding; that is genuinely new.

## Files
| file | change |
|---|---|
| src/export/csv.ts | new: encode rows to CSV, escaping quotes and newlines |
| src/http/routes/export.ts | new: GET /v1/export, streams the response |
| src/query/filter.ts | modified: expose the row count estimate |

## Order
1. CSV encoder with unit tests. Green on its own.
2. Row count estimate and the 50,000 refusal. Green.
3. Route wiring and the streamed response. Green.

## Risks
| risk | impact | mitigation |
|---|---|---|
| Column permission filter is applied after the query | leaks a column | apply in buildFilter, add R-003 test |

## Human approval required
Step 2 reads the permission table. Flagged: authorisation logic.

## Verification
npm test, then curl the endpoint with a filter matching 3 rows and with one
matching 60,000, and confirm the second is refused by message, not by timeout.
```

## Validation

- [ ] A search for existing code happened and its result is recorded.
- [ ] Every file to change is named.
- [ ] The rejected alternative is stated with its reason.
- [ ] Every step leaves the repository green.
- [ ] Each risk has a mitigation.
- [ ] Steps touching auth, crypto, payment or data loss are flagged.
- [ ] No code was written.

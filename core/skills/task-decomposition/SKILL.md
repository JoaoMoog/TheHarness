---
name: task-decomposition
description: Break an approved plan into atomic tasks, mark the ones that can run in parallel, and classify each by how much human oversight it needs. Use in the tasks phase.
version: 1.0.0
sfa: "scope: one approved plan | format: a tasks.md table with parallel and oversight markers | audience: the implementer and the human approving the batch"
stacks: []
alwaysApply: false
---

# task-decomposition

## Rules

A task is atomic when it can be finished and verified on its own, and when
finishing it leaves the repository building with its tests passing.

Mark a task parallel only when it shares no file with any other unblocked task
and depends on nothing still open. Marking dependent work as parallel produces
merge conflicts that cost more than the sequencing saved.

Classify every task by impact and reversibility. This quadrant decides how much
a human has to watch:

| | reversible | hard to reverse |
|---|---|---|
| low impact | Q1 automate: run it, report after | Q3 confirm: state the plan, wait for yes |
| high impact | Q2 review: run it, human reviews before merge | Q4 dual control: a human runs it, the agent assists |

Anything touching authentication, authorisation, cryptography, payment, a
production schema change, a deletion, or an infrastructure apply is Q4 by
default. Moving something out of Q4 needs a written reason.

Every task states how it is verified: a command, or an observable outcome. A
task with no verification cannot be marked done honestly.

Anti-patterns to refuse:

- a task that says "implement the feature"
- a task whose verification is "it looks right"
- marking everything parallel because it is faster on paper
- putting a schema migration and its backfill in one task

## Workflow

1. Walk the plan order of work and turn each step into one or more tasks.
2. For each task, name the files it touches.
3. Compute dependencies from file overlap, not from intuition.
4. Mark parallel where files and dependencies genuinely allow it.
5. Assign the quadrant. Default to the more cautious one when unsure.
6. Write the verification for each task.
7. Order the list so dependencies come first.

## Output

```
| id | task | files | verify | dep | P | Q |
|----|------|-------|--------|-----|---|---|
| T1 | CSV encoder with quote and newline escaping | src/export/csv.ts | npm test csv | - |   | Q1 |
| T2 | Row count estimate on the filter builder | src/query/filter.ts | npm test filter | - | P | Q1 |
| T3 | Refuse over 50000 rows and name the limit | src/http/routes/export.ts | curl returns 413 with the number | T2 |   | Q2 |
| T4 | Apply column permissions inside buildFilter | src/query/filter.ts | test FR-003 passes | T2 |   | Q4 |

T4 is Q4 because it changes authorisation: a human runs and reviews it.
```

## Validation

- [ ] Every task is finishable and verifiable on its own.
- [ ] Every task names its files and its verification.
- [ ] Parallel is marked only where no file is shared and nothing is pending.
- [ ] Every task has a quadrant, and auth, crypto, payment, schema, deletion and
      infrastructure apply are Q4.
- [ ] Dependencies come before dependents.
- [ ] No task is "implement the feature".

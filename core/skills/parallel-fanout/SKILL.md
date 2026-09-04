---
name: parallel-fanout
description: Run independent tasks in parallel sub-agents with isolated contexts, and merge their results through one aggregation step instead of hoping they fit. Use when a task list has more than one unblocked task marked parallel.
version: 1.0.0
sfa: "scope: one batch of parallel tasks | format: N isolated runs plus one aggregation report | audience: the orchestrator deciding how to spend the batch"
stacks: []
alwaysApply: false
---

# parallel-fanout

## Rules

Parallel only pays for **independent** work. Two tasks that touch the same file
are not independent, whatever the task list says, and running them in parallel
produces a merge nobody asked for. `[P]` in the task list is a claim; verify it
against the file lists before trusting it.

Each sub-agent gets its own context and only its own task: the task text, its
acceptance criteria, and the session summaries. It does not get the other
tasks. Shared context is how parallel runs converge on the same mistake.

**Fan-out without aggregation is the anti-pattern.** N sub-agents return N
change sets; someone has to merge them, resolve what overlaps, and prove the
combination works. That someone is a step, not an assumption. The full suite
runs once, on the merged result — N green suites on N partial trees prove
nothing about the whole.

Bound the batch. The cap comes from the track budget in `loops/budgets.json`,
not from how many tasks happen to be unblocked. Five parallel runs cost five
contexts, and the session pays for all of them whether or not they land.

Sub-agents default to the mid-tier model. A parallel batch is execution of
decisions already made in the plan; the frontier tier is for the plan.

Anti-patterns to refuse:

- parallel tasks that share a file
- giving every sub-agent the whole task list
- declaring the batch done because each run reported green
- a batch larger than the budget allows, on the theory that it is faster

## Workflow

1. Take the unblocked tasks marked `[P]` and check their file lists against
   each other. Any overlap serialises those two.
2. Cap the batch by the track budget.
3. Launch one `implementer` per task with an isolated context: the task, its
   criteria, the summaries. Nothing else.
4. Collect each handoff envelope. A `blocked` or `escalated` envelope stops the
   batch from being declared complete.
5. **Aggregate:** merge the change sets, resolve any overlap explicitly, run
   the full suite once on the merged tree, run the traceability matrix.
6. Report the batch as one envelope: which tasks landed, which did not, and the
   suite result on the merged result.

## Output

```
Batch: T2, T3, T5   (T4 shares src/api/list.ts with T2 - serialised after)
Budget: 3 of 5 parallel slots

  T2  complete   src/reports/exportButton.tsx, tests/export.spec.ts
  T3  complete   src/reports/useReport.ts, tests/useReport.spec.ts
  T5  blocked    needs the decision on the filename; escalated

Aggregation
  merged T2 + T3, no overlap
  full suite on the merged tree: 219 passing
  traceability: FR-001, FR-002 verified; FR-003 pending T5

Batch result: 2 of 3 landed. T5 is a question for the human before T4 runs.
```

## Validation

- [ ] No two tasks in the batch touch the same file.
- [ ] Each sub-agent received only its own task and the summaries.
- [ ] The batch size respects the track budget.
- [ ] Every envelope was collected; none was assumed.
- [ ] The full suite ran once on the merged tree, not per run.
- [ ] The batch reported as one envelope with what landed and what did not.

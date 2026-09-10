---
version: 1.1.0
mode: agent
description: Run the bounded verify loop - implement, check against the governing checklist, fix, repeat, capped at three iterations.
---

Run the verify loop defined in `loops/verify.md` for the task described below.

Before the first iteration, state:

- the task in one sentence
- which skill checklist governs it, the targeted tests you will run while
  iterating, and the repository build, lint and test commands you will run once
  on the final tree
- the cap you are working under: 3 iterations, 60k tokens

Then loop: implement, verify, judge, fix. Announce the iteration number at the
start of each pass and report the real output of every command you run, with
the tree state it ran on (`node .github/tools/verify/tree-state.mjs`).

Spend each iteration on the failure that caused it: re-run the check that
failed, not the ones that passed on an unchanged tree, and do not re-read files
that did not change. A problem that already existed in a file you touched is a
WARN in the report - location, problem, suggested improvement - not a fix and
not an extra iteration.

Stop and escalate if three iterations are used, the budget is exhausted, the
same check fails twice in a row, the suite is red for a reason outside the
change, or a fix would require breaking a hard constraint in `CONSTITUTION.md`.

Finish with the iteration count, the final state of every check, and anything
still failing or warned. If you exit at the cap, say so plainly - do not report
partial work as complete. If everything passed on the final tree, stop: another
pass without a new failure is spend, not verification.

Task: ${input:task}

# verify loop

Implement, check the work against the checklist that governs it, fix what
failed, repeat. Bounded at three iterations.

Budget: see `budgets.json`. Three iterations, 60k tokens, stop when every
applicable checklist item passes and the repository build, lint and tests pass
on the final tree.

## Why it is bounded

Each iteration resends the accumulated history, so cost grows faster than the
number of turns. Three passes is where the return stops justifying the spend: if
a check still fails on the third attempt, the problem is the understanding, not
the effort, and a human should look at it.

## What an iteration is for

An iteration turns one specific failure into a pass. It is not a chance to
re-read files that did not change, re-run checks that already passed on the
same tree, or improve what already works. A check that passed stays passed
until the tree changes; a file that was read stays read until it is edited.

The governing checklist is the one skill named for this work - `debugging` for
a defect, `acceptance-tests` for a criterion - not every checklist of every
skill loaded. An item that does not apply to this change is marked n/a, not
iterated on.

## The loop

1. **Implement.** Make the change.
2. **Verify.** First iteration: run the governing checklist and the targeted
   tests - the reproduction, and the tests of the files changed. Later
   iterations: re-run the check that failed, then anything the fix could have
   affected. Record real output and the tree state it ran on
   (`node .github/tools/verify/tree-state.mjs`).
3. **Judge.** Something failed: continue. Everything passed: run the full
   build, lint and suite once, on this final tree. Green means stop and report.
   A new failure means one more iteration, starting from that failure.
4. **Fix.** Address the specific failure. Do not rewrite what was passing, and
   do not touch what the failure does not name.
5. Return to step 2, incrementing the iteration count.

A failure in code the change did not touch is not this loop's to fix. It is
reported as a WARN with the location and the suggested fix, and the loop
escalates only if it stops the suite from proving the change.

## Stop conditions

Stop and report success when every applicable checklist item passes and the
full build, lint and suite passed once on the final tree. Do not start another
iteration after that: a new iteration needs a new failure, an open finding or
an unchecked risk, and polish is none of those.

Stop and escalate when any of these is true:

- three iterations are used
- the token budget is exhausted
- the same check fails twice in a row, which means the fix is not addressing the
  cause
- the suite is red for a reason outside the change, so the change cannot be
  proven
- a fix would require violating a hard constraint in `../CONSTITUTION.md`

## Reporting

Always report the iteration count, the final state of every check, the tree
state the final run used, and anything still failing or warned. A loop that
exits at the cap reports partial success with the remaining failures listed -
never as if it had finished.

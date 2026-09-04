# verify loop

Implement, check the work against the checklist that governs it, fix what
failed, repeat. Bounded at three iterations.

Budget: see `budgets.json`. Three iterations, 60k tokens, stop when every
checklist item passes and the repository build, lint and tests pass.

## Why it is bounded

Each iteration resends the accumulated history, so cost grows faster than the
number of turns. Three passes is where the return stops justifying the spend: if
a check still fails on the third attempt, the problem is the understanding, not
the effort, and a human should look at it.

## The loop

1. **Implement.** Make the change.
2. **Verify.** Run the validation checklist from the skill that governs this
   work, then run the repository build, lint and test commands. Record real
   output.
3. **Judge.** All pass, stop and report. Something failed, continue.
4. **Fix.** Address the specific failure. Do not rewrite what was passing.
5. Return to step 2, incrementing the iteration count.

## Stop conditions

Stop and report success when every checklist item and every repository command
passes.

Stop and escalate when any of these is true:

- three iterations are used
- the token budget is exhausted
- the same check fails twice in a row, which means the fix is not addressing the
  cause
- a fix would require violating a hard constraint in `../CONSTITUTION.md`

## Reporting

Always report the iteration count, the final state of every check, and anything
still failing. A loop that exits at the cap reports partial success with the
remaining failures listed — never as if it had finished.

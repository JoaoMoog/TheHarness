---
version: 1.0.0
mode: agent
description: Run the bounded verify loop - implement, check against the governing checklist, fix, repeat, capped at three iterations.
---

Run the verify loop defined in `loops/verify.md` for the task described below.

Before the first iteration, state:

- the task in one sentence
- which skill checklist governs it, and the repository build, lint and test
  commands you will run
- the cap you are working under: 3 iterations, 60k tokens

Then loop: implement, verify, judge, fix. Announce the iteration number at the
start of each pass and report the real output of every command you run.

Stop and escalate if three iterations are used, the budget is exhausted, the
same check fails twice in a row, or a fix would require breaking a hard
constraint in `CONSTITUTION.md`.

Finish with the iteration count, the final state of every check, and anything
still failing. If you exit at the cap, say so plainly - do not report partial
work as complete.

Task: ${input:task}

---
version: 1.0.0
mode: agent
description: Run the bounded generator and evaluator loop against a rubric declared up front, capped at four iterations.
---

Run the evaluate loop defined in `loops/evaluate.md` for the work described
below.

First, before generating anything:

1. Write the rubric - three to six criteria, each scored 1-5, each with a
   description of what the levels mean for this task.
2. Declare the passing threshold as a number.
3. State the cap: 4 iterations, 120k tokens.

Then loop: generate, evaluate against the rubric as a separate pass, revise the
lowest-scoring criterion first without regressing the others.

Stop and escalate if four iterations are used, the budget is exhausted, two
consecutive iterations move the score by less than one point, or the score
falls - a falling score means the rubric or the task statement is wrong, not
that the generator needs another attempt.

Report the rubric, the score per criterion per iteration, and the final verdict.

Work: ${input:task}

# evaluate loop

A generator produces work and a separate evaluator scores it against a rubric
written before either ran. Bounded at four iterations.

Budget: see `budgets.json`. Four iterations, 120k tokens, stop at the threshold
or when the score stops moving.

## Why it is bounded

The generator will keep producing variations indefinitely, and each one costs
the full accumulated context. The rubric and the threshold are declared up front
precisely so the loop has a definition of done that is not the generator own
opinion of its work.

## Setup, before the first iteration

1. Write the rubric: three to six criteria, each with a 1-5 scale and a
   description of what each level looks like.
2. Declare the passing threshold as a number.
3. Confirm the evaluator is a separate pass with its own context. A generator
   grading itself converges on self-agreement, not on quality.

## The loop

1. **Generate.** Produce or revise the work.
2. **Evaluate.** Score against each rubric criterion. For every score below the
   threshold, state the specific gap and the change that would close it.
3. **Judge.** At or above threshold, stop. Below, continue.
4. **Revise.** Address the lowest-scoring criterion first. Do not regress the
   criteria that already pass.
5. Return to step 2.

## Stop conditions

Stop and report success when the score reaches the declared threshold.

Stop and escalate when any of these is true:

- four iterations are used
- the token budget is exhausted
- two consecutive iterations move the score by less than one point, which means
  the remaining gap is not something more iterations will close
- the score falls between iterations, which means the rubric or the task
  statement is wrong and no amount of generation will fix it

## Reporting

Report the rubric, every score per iteration, and the final verdict. A run that
stopped at the cap reports the best score reached and the criteria still short.

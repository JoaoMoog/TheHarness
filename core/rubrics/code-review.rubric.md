---
name: code-review
description: How a change is scored during the review phase.
version: 1.1.0
appliesTo: review
threshold: 3
---

# code-review

## Criteria

| id | criterion | what it asks |
|---|---|---|
| C1 | Correctness | Does it produce the right result for the inputs it will actually see, including the boundaries? |
| C2 | Requirement fit | Does every changed behaviour trace to a requirement, and every requirement to a test? |
| C3 | Failure handling | Are the paths that can fail handled or propagated, with context, and never swallowed? |
| C4 | Test quality | Do the tests assert observable behaviour, and would they fail if the code were wrong? |
| C5 | Fit with the codebase | Does it read like the code around it, and reuse what already exists? |

## Levels

Score each criterion 1 to 5. The wording matters more than the number: a 3 is
shippable, not a compliment.

- **5** — Nothing to add. The boundary cases are covered and the reasoning is
  visible in the code or the tests.
- **4** — Correct, with a suggestion that does not block.
- **3** — Correct for the cases that matter, with a gap that is written down and
  accepted. Shippable.
- **2** — A real defect with a concrete failure scenario, or a requirement with
  no test. Not shippable.
- **1** — Wrong for the main path, or the change cannot be judged because it is
  too large or too unclear to review.

## Threshold

Every criterion at **3 or above**, and no criterion at 2 or below.

A single 2 blocks the change, regardless of the average. Averaging is how a real
defect gets outvoted by four comfortable scores.

## Scoring rules

Score against the criterion, not against how you would have written it. A
different-but-correct approach is a 4 or a 5.

Every score below 4 names the concrete failure: the input or state, and the
wrong result. A low score without that is a preference wearing a number.

Score the change, not the file. Each criterion is scored on the lines the
change introduced or altered and the behaviour they produce. A gap that
predates the change does not lower a score: it is a `warn` finding beside the
scores. C3 in particular: a handler the application's global exception
handling already covers is not a failure-handling gap.

On a track with no specification - patch, incident, refactor - C2 is scored
against the request as stated, and the traceability matrix is not required.

C4 is scored on the tests and what they assert, not on who ran them. A green
implement record reused on the same tree state is valid evidence for it; the
reviewer's own run is the targeted check on the changed files.

The agent that produced the change never scores it. Self-assessment converges on
self-agreement, not on quality.

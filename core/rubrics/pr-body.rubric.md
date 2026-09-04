---
name: pr-body
description: How the pull request description is scored before it is opened.
version: 1.0.0
appliesTo: deliver
threshold: 3
---

# pr-body

## Criteria

| id | criterion | what it asks |
|---|---|---|
| P1 | Why, not what | Does it explain the reason, rather than restating the diff? |
| P2 | Verification is real | Does it report what actually ran, failures included? |
| P3 | Traceability | Is the matrix present, with every gap either closed or explained? |
| P4 | Scope is honest | Is what was left out written down? |

## Levels

- **5** — A reviewer who was not in the session can judge the change from the
  body alone.
- **4** — Complete, with one thin section.
- **3** — The four questions are answered. Shippable.
- **2** — Lists the changed files, or claims a pass nobody observed.
- **1** — Says "changes" or repeats the branch name.

## Threshold

Every criterion at **3 or above**.

P2 at 2 is a false report, not a style problem: it is the one score that should
stop the delivery rather than generate a comment.

## Scoring rules

A body that is longer than the diff is not scoring higher. Brevity that answers
the four questions beats completeness that buries them.

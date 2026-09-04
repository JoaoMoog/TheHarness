---
name: rubric-review
description: Score work against a versioned rubric so the judgement is comparable across weeks and reviewers, instead of depending on who looked and when. Use in any phase that produces a verdict.
version: 1.0.0
sfa: "scope: one artifact and the rubric that applies to it | format: a score per criterion with evidence | audience: the person deciding whether this proceeds"
stacks: []
alwaysApply: false
---

# rubric-review

## Rules

Deterministic checks come first and are not negotiable: the build, the linter,
the test suite, the traceability matrix. A rubric never overrides a red test. It
answers the second question — *is it good* — only after the first one, *did it
work*, already said yes.

The rubric is a file with a version. When the standard changes, the file changes
in a pull request like anything else. A standard that lives in a reviewer head
drifts, and nobody can tell whether last month was stricter.

**The generator never scores its own work.** Self-assessment converges on
self-agreement rather than on quality, and it is the single most common way an
automated review becomes theatre. The scoring pass runs with its own context.

Every score below 4 names the concrete failure: the input or state,
and the wrong result. A number with no evidence is a preference that learned to
count.

**Do not average.** The threshold is per criterion. One criterion at 2 blocks
the work even when the other four are at 5, because averaging is exactly how a
real defect gets outvoted by four comfortable scores.

Anti-patterns to refuse:

- scoring against how you would have written it. A different-but-correct
  approach scores high
- inflating to avoid a conversation, or deflating to look rigorous
- adding a criterion during the review. If the rubric is wrong, say so and fix
  the rubric; do not judge against a standard the author could not have read
- scoring an artifact you could not fully read, instead of saying so

## Workflow

1. Run the deterministic checks. If any fails, stop and report that. There is
   nothing to score yet.
2. Load the rubric whose `appliesTo` matches this phase, from
   `.github/rubrics/`. Note its version.
3. Score each criterion against its level descriptions, in order.
4. For each score below the top level, write the evidence: file, line, and the
   concrete failure.
5. Compare each score to the threshold, not the average.
6. Report the scores, the verdict, and the rubric version used.

## Output

```
rubric: code-review v1.0.0    threshold: 3 per criterion

  C1 correctness        2   src/api/list.ts:42
                            offset uses page * size; page=1 returns rows 21-40
  C2 requirement fit    4   FR-003 has no test, and the PR says why
  C3 failure handling   4
  C4 test quality       3   the empty-result branch is untested
  C5 fit                5

verdict: request-changes
  C1 is below threshold. One criterion under the bar blocks, regardless of the
  rest.
```

## Validation

- [ ] The deterministic checks ran first and passed.
- [ ] The rubric was loaded from a file, and its version is in the output.
- [ ] Every criterion has a score.
- [ ] Every score below the top level has concrete evidence.
- [ ] The verdict came from the per-criterion threshold, not from an average.
- [ ] The agent that produced the work did not score it.

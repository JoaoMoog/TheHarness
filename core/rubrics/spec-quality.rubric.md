---
name: spec-quality
description: How a specification is scored before planning is allowed to start.
version: 1.0.0
appliesTo: specify
threshold: 3
---

# spec-quality

## Criteria

| id | criterion | what it asks |
|---|---|---|
| S1 | Testable | Could each requirement be turned into a test without asking anyone a question? |
| S2 | Unambiguous | Would two engineers build the same thing from this? |
| S3 | Scoped | Is what it does not do written down? |
| S4 | Honest about gaps | Is every ambiguity marked, rather than resolved by a quiet assumption? |
| S5 | Complete on failure | Are the unwanted conditions specified, not only the happy path? |

## Levels

- **5** — Every requirement is a test waiting to be written, and the non-goals
  are explicit.
- **4** — Testable throughout, with one requirement that needs a number.
- **3** — Testable for the main paths, with the gaps marked. Planning can start.
- **2** — A requirement that two people would read differently, or a measure
  stated as an adjective. Planning cannot start.
- **1** — Describes a solution rather than an outcome, or has no acceptance
  criteria at all.

## Threshold

Every criterion at **3 or above**, and **zero** open `[NEEDS CLARIFICATION]`
markers.

The second half is not negotiable by score. An open question means two readings
produce different systems, and no average makes that safe to build on.

## Scoring rules

"Fast", "reliable", "user-friendly" are automatic 2s on S1. A non-functional
requirement without a number is not a requirement.

A specification that names a library, a table or an endpoint is scoring low on
S1 for the wrong reason: it has leaked implementation, and it will stop being
true the moment the stack moves.

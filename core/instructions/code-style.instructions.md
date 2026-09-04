---
applyTo: "**"
description: Language-agnostic conventions for structure, naming and change size. Repository conventions win where they differ.
---

# Code style

The surrounding code wins. If this file and the file you are editing disagree,
follow the file you are editing and mention the difference.

## Change size

Change the minimum that satisfies the request. Do not reformat untouched lines,
do not rename things you are passing through, and do not fix adjacent problems
uninvited — flag them instead.

## Structure

Prefer many small files with one clear responsibility over few large ones.
Roughly 200-400 lines per file is comfortable; past 800 the file is doing more
than one job.

Functions stay short enough to read without scrolling. Deep nesting is a smell —
return early instead of stacking conditionals four levels deep.

## Immutability

Return new values rather than mutating arguments or shared state. Mutation is
allowed where the language and the surrounding code expect it (a hot loop, a
builder, an idiomatic accumulator) and should be local and obvious.

## Naming

Names say what the thing is, not what type it has. Booleans read as predicates:
`isReady`, `hasAccess`, `shouldRetry`, `canEdit`. Constants for any number that
carries meaning — a timeout, a limit, a threshold. A literal `300` in a
condition is a question mark for the next reader.

## Comments

Explain why, not what. A comment restating the code is maintenance debt that
will eventually contradict it. Comment the surprising decision, the constraint
that is not visible locally, and the reason a simpler approach was rejected.

## Errors

Handle explicitly or propagate. An empty catch is a defect, and so is a catch
that logs and continues as though nothing happened. Messages a user sees say
what to do next; messages a log sees carry the context to diagnose.

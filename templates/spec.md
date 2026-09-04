# Specification: <feature name>

Status: draft | approved
Owner: <name>

## Problem

What is wrong today, for whom, and what it costs. Not the solution.

## Goal

One sentence. What is true when this is done that is not true now.

## Out of scope

What this deliberately does not do. A reader cannot distinguish an omission from
an oversight unless you tell them.

## Requirements

Every requirement carries a **stable id**. The id is what links this line to a
test and to a commit, and it must never be renumbered once the spec is approved
— a renumbered id silently breaks every trace pointing at it.

Use `FR-` for functional requirements and `NFR-` for everything else
(performance, security, accessibility, operability).

Each one uses an EARS pattern, so it is testable by construction:

| id | pattern | requirement |
|---|---|---|
| FR-001 | Ubiquitous | The system SHALL ... |
| FR-002 | Event | WHEN ..., the system SHALL ... |
| FR-003 | State | WHILE ..., the system SHALL ... |
| FR-004 | Optional | WHERE ..., the system SHALL ... |
| FR-005 | Unwanted | IF ..., THEN the system SHALL ... |
| FR-006 | Complex | WHEN ..., IF ..., THEN the system SHALL ... |
| NFR-001 | Ubiquitous | The system SHALL ... within ... at ... |

Include the unwanted-condition cases. A specification with only happy paths
produces an implementation with only happy paths.

A non-functional requirement states a number. "Fast" is not a requirement;
"p95 under 200 ms at 1000 requests per second" is.

## Open questions

Ambiguity is marked, never guessed:

`[NEEDS CLARIFICATION: does the export filename need the tenant name?]`

The session does not leave the specify phase while one of these is open. That
is the whole point of writing it down rather than picking an answer quietly.

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/<id>-<slug>
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

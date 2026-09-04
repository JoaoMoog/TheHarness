# Implementation plan: <feature name>

Specification: <link to spec.md>

## Approach

Two or three sentences. Include the obvious alternative and why it was rejected.

## Reuse found

What already exists in this repository that this plan uses instead of
reimplementing, with paths. Finding nothing is a result worth recording.

## Files

| File | Change |
|---|---|
| `path/to/file` | created / modified: what changes |

## Contracts

Interfaces, schemas and data shapes this introduces or alters. Note any that are
breaking for an existing consumer.

## Order of work

Numbered. Each step leaves the repository building with its tests passing.

1. ...
2. ...

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| | | |

Flag explicitly any step that touches authentication, authorization,
cryptography or payment, or that is irreversible. Those require human approval
before they run.

## Verification

How the finished result is checked end to end: the commands to run, the
behaviour to observe, and what a pass looks like.

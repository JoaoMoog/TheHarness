# Session <NNN>-<slug>

id: <NNN>
feature: <one line, what the user asked for>
track: <patch | incident | fix | refactor | feature | spike>
promoted from: <none, or the track this session started on and why>
track reason: <one line, and what the omitted phases would have added>
phase: <first phase of the track>
started: <YYYY-MM-DD>

The orchestrator reads this file and nothing else between phases. Everything a
later phase needs must be written here, in the summary of the phase that
produced it. Detail lives in the phase artifact; this file holds the state and
the summaries.

## Phases

| phase | status | approved by | artifact | summary |
|---|---|---|---|---|
| specify | pending | | spec.md | |
| plan | blocked | | plan.md | |
| tasks | blocked | | tasks.md | |
| implement | blocked | | code + tests | |
| review | blocked | | verdict | |
| deliver | blocked | | pull request | |

## Scores

One line per judged phase: the rubric and its version, the score per
criterion, and the lowest one. Filled by the reviewer, never by the phase that
produced the work.

| phase | rubric | scores | lowest |
|---|---|---|---|

A phase that is not in this track is marked skipped, with the track as the
reason. Status is one of: pending, running, complete, blocked, escalated,
skipped.
A phase moves out of blocked only when the phase before it is complete and a
human has approved it. Approval is recorded here by name, not assumed.

## Decisions

Choices made during this session that a later phase must not silently reverse.
One line each, with the reason.

## Open questions

Anything ambiguous enough that two readings produce different systems. The
session does not advance past specify with an unanswered question here.

## Budget

| phase | agent | model | tokens | duration |
|---|---|---|---|---|

Filled from the telemetry hook. If a phase costs several times its neighbours,
that is the phase to look at first.

## Summaries

Appended by each phase as it completes. At most 200 words each: this is the
context the orchestrator carries forward, so it is the one place where being
terse actually pays for itself.

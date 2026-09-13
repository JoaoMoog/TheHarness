---
name: session-summary
description: Write the per-phase summary the orchestrator carries between agents, keeping the parent context small while losing nothing a later phase needs. Use at the end of every phase of a multi-agent session.
version: 1.0.0
sfa: "scope: one completed phase | format: a fixed-field handoff envelope under 200 words | audience: the orchestrator and the next phase agent"
stacks: []
alwaysApply: false
---

# session-summary

## Rules

The envelope has a fixed core - `stage`, `status`, `artifacts`, `summary`, `next` -
and phases add typed fields to it: `verified` from implement and review, `scores`
from any judged phase, `pullRequest` and `pipelineRun` from deliver. The core is
what the orchestrator reads to advance; the extensions are what it records.

The parent keeps summaries; the children keep detail. The orchestrator never
reloads spec, plan and tasks together, because the whole point of the split is
that the accumulated transcript is resent on every turn and grows faster than
the work does.

A summary is written for the next phase, not for a human reading later. Ask what
the next agent would otherwise have to re-derive, and write that.

Two hundred words is the ceiling, and it is generous. If the summary needs more,
the phase produced more than one decision and the extra belongs in the artifact.

Never summarise away: a decision that constrains later work, an open question, a
deviation from what was planned, or a discovered constraint. Those four survive
even when everything else is cut.

Anti-patterns to refuse:

- restating the artifact instead of summarising it
- a summary that reads as progress reporting rather than state
- dropping an open question because the phase completed anyway
- claiming a status of complete when a check was skipped

## Workflow

1. Name the artifact this phase produced and where it lives.
2. Write the one sentence the next phase most needs to know.
3. List the decisions that constrain later phases.
4. List anything still open, and who has to answer it.
5. Set the status: complete, blocked or escalated. Blocked and escalated both
   require the reason.
6. Emit the envelope. The orchestrator records it in session.md in one edit -
   summary, status, scores and warnings together - so a phase costs one write,
   not four.

## Output

Every phase agent ends its response with exactly this block:

```harness-handoff
stage: specify
status: complete
artifacts: specs/007-export-csv/spec.md
summary: Six EARS criteria cover the happy path, an empty result set and a
  permission failure. Export is scoped to the current filter, not the whole
  table, because the table can exceed a million rows. Open: whether the file
  name must include the tenant, which changes the storage path.
next: plan
```

Fields: `stage`, `status`, `artifacts`, `summary`, `next`. Status is one of
complete, blocked, escalated.

## Validation

- [ ] The summary is at most 200 words.
- [ ] Every decision that constrains a later phase is in it.
- [ ] Every open question is in it, with who must answer.
- [ ] Status reflects what actually happened, not what was hoped.
- [ ] The artifact path is real and was written.
- [ ] The envelope reached session.md in the orchestrator's single edit for the
      phase.

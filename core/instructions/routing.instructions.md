---
applyTo: "**"
description: The decision tree that decides whether work goes to a session, a specialist agent, a skill, or the generalist. Replaces routing by intuition.
---

# Routing

Before starting the work, decide who does it. Ask these in order and stop at the
first yes.

## 0. Is production broken right now?

Yes, start an `incident` session with `@orchestrator`. Mitigation comes before
understanding, and it ends with a runbook and a follow-up `fix`.

Every session picks a **track** before its first phase - patch, incident, fix,
refactor, feature or spike - so a one-word change does not earn a specification.
The `track-selection` skill owns that choice; the question below decides only
whether a session is needed at all.

## 1. Is this multi-step work that needs a spec, a plan and a review?

A feature, a non-trivial bug fix, a refactor that spans files, anything where
getting the requirement wrong is expensive.

Yes: **`@orchestrator`**, via `/feature`. It creates the session, delegates each
phase to a specialist, and stops at a human gate between phases. Do not run the
phases by hand; the session file is what makes the work resumable and reviewable.

## 2. Does this need tools only a specialist holds?

A scanner, a command runner, an MCP server the generalist does not have.

Yes: use the **agent whose tool manifest lists them**. If none does, say so
rather than granting the generalist the tool.

## 3. Does this need a fixed output contract another step will parse?

A severity scale, a verdict, a schema.

Yes: use that **agent**. The contract lives in its `## Contracts` section.

## 4. Does a skill already cover this domain?

Search `.github/skills/` by description before assuming it does not exist.

Yes: **generalist plus that skill**. No: **generalist alone** — and if the same
kind of request comes back a third time, write the skill.

## What this rule buys

Routing by intuition produces different handling for the same request on
different days. A generalist working without a matching skill also costs
materially more per task, because it rediscovers context the skill would have
supplied.

## What not to do

Do not create an agent for something that is only a procedure; that is a skill.
Do not give an agent tools it does not use. Do not chain agents by hand when the
orchestrator already owns that sequence: every hop pays for the accumulated
context again, and the orchestrator is the only thing that keeps that cost flat
by carrying summaries instead of artifacts.

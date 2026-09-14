---
applyTo: "**"
description: The decision tree that decides whether work is done directly in the chat, goes to a session, a specialist agent, a skill, or the generalist. Replaces routing by intuition.
---

# Routing

Before starting the work, decide who does it. Ask these in order and stop at the
first yes.

## 0. Is production broken right now?

Yes, start an `incident` session with `@orchestrator`. Mitigation comes before
understanding, and it ends with a runbook and a follow-up `fix`.

## 1. Is this a small change?

One sentence to state, at most three files, and either no behaviour change or
one existing check that proves it: a test, the build, the linter. Yes: **do it
here.** Read what you need, edit, run that check, show the diff and its result.
No session, no sub-agent, no review round: the person reviews the diff in the
editor, then commits or asks for `/deliver`. Never here: auth, crypto,
payment, money, a production schema, a dependency manifest.

## 2. Is this multi-step work that needs a spec, a plan and a review?

A feature, a non-trivial bug fix, a refactor that spans files, anything where
getting the requirement wrong is expensive.

Yes: **`@orchestrator`**, via `/feature`. It creates the session, picks a
**track** - patch, incident, fix, refactor, feature or spike, so a small change
that wants a pull request does not earn a specification - delegates each phase
to a specialist, and stops at a human gate between phases. Do not run the
phases by hand; the session file is what makes the work resumable and
reviewable. The `track-selection` skill owns the choice of track.

## 3. Does this need tools only a specialist holds?

A scanner, a command runner, an MCP server the generalist does not have.

Yes: use the **agent whose tool manifest lists them**. If none does, say so
rather than granting the generalist the tool.

## 4. Does this need a fixed output contract another step will parse?

A severity scale, a verdict, a schema.

Yes: use that **agent**. The contract lives in its `## Contracts` section.

## 5. Does a skill already cover this domain?

Search `.github/skills/` by description before assuming it does not exist.

Yes: **generalist plus that skill**. No: **generalist alone** - and if the same
kind of request comes back a third time, write the skill.

## What not to do

Do not create an agent for something that is only a procedure; that is a skill.
Do not give an agent tools it does not use. Do not chain agents by hand when the
orchestrator already owns that sequence: every hop pays for the accumulated
context again, and the orchestrator is the only thing that keeps that cost flat
by carrying summaries instead of artifacts.

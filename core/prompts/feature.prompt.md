---
mode: agent
description: Starts a session. Chooses the track with the human, records it, and runs the first phase of that track.
version: 1.0.0
---

Start a session with `@orchestrator` for the request below.

Before anything else:

0. Cross TK first. If the session start names it, read its tools from their
   descriptions and make the first read through it. If nothing has recorded
   it yet, look for it in your tool list and, found, write
   `.harness/crosstk.json` with the server and tool names before any read.
   The harness refuses a built-in read before that, and so does the
   orchestrator.
1. If `specs/_context.md` does not exist, say so in one line and continue:
   the implementer and the reviewer use the scripts the repository manifest
   defines. Offer the `codebase-inventory` skill only when the track chosen
   below is feature or refactor; every session after that one is cheaper for it.
2. If other sessions are open, list them with their phase and work branch and
   continue: this session gets the next id and its own work branch, and a
   person doing two unrelated adjustments in two chats has two sessions. Say
   so when the new request touches files an open session is changing; that is
   the one real conflict, and the person decides.
3. Allocate the next id and create `specs/<id>-<slug>/session.md` from
   `templates/session.md`, with phase `specify`.

Then choose the track with the `track-selection` skill and, in the same
message, ask which branch the work starts from: `Production` by default, or
the current branch `<name>` to continue on it. State the two answers, name the
track, list the phases it runs and the budget, and stop for the human to
confirm both. Record the track, the reason, the base branch and the work branch
in `session.md`. Only then fetch the base, create `<type>/<slug>` from it, or
stay where the person chose to stay, and delegate the **first phase of that
track** to its agent - `specifier` for fix, feature and spike, `planner` for
refactor, `implementer` for patch and incident - passing the request and the
repository context. Do not write the specification yourself.

When it returns, record it in `session.md` in one edit - summary, status,
scores and warnings together - and report: what the phase produced, what is
still open, and where the file is. Then stop at the approval gate; advancing is
the human's action, except that on patch and incident the review starts as soon
as implement returns complete.

If it returns `blocked` or `escalated`, say why and stop. Do not re-prompt it
with a different question hoping for a different status.

Request: ${input:request}

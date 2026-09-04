---
mode: agent
description: Starts a session. Chooses the track with the human, records it, and runs the first phase of that track.
version: 1.0.0
---

Start a session with `@orchestrator` for the request below.

Before anything else:

1. If `specs/_context.md` does not exist, say so and offer to run the
   `codebase-inventory` skill first. Every session after that one is cheaper for it.
2. If a session is already open, stop. Resume it with `/resume` or close it.
   Two open sessions on one repository produce conflicting plans.
3. Allocate the next id and create `specs/<id>-<slug>/session.md` from
   `templates/session.md`, with phase `specify`.

Then choose the track with the `track-selection` skill: state the two answers, name
the track, list the phases it runs and the budget, and stop for the human to
confirm. Record the track and the reason in `session.md`. Only then delegate
the **first phase of that track** to its agent - `specifier` for fix, feature and
spike, `planner` for refactor, `implementer` for patch and incident. Then delegate
the phase, passing the request and the
repository context. Do not write the specification yourself.

When it returns, append its summary to `session.md`, set the phase status, and
report: what the specification says, what is still open, and where the file is.
Then stop at the approval gate. Advancing is the human's action.

If it returns `blocked` or `escalated`, say why and stop. Do not re-prompt it
with a different question hoping for a different status.

Request: ${input:request}

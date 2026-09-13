---
mode: agent
description: Resume an open multi-agent session from its recorded state.
version: 1.0.0
---

Resume the session with `@orchestrator`.

0. Cross TK first. If the session start names it, use it before any read; if
   nothing has recorded it yet, look for it in your tool list and, found,
   write `.harness/crosstk.json` first. The harness refuses a built-in read
   before a Cross TK tool has been used.
1. Read `specs/<id>-*/session.md`. If no id is given, use the newest session
   whose phase is not `done`.
2. Report the current phase, the work branch, what the last summary said, and
   what is open. If the checkout is not on that work branch, say so and stop;
   switching branches is the person's call.
3. Load only what the next phase needs: the session summaries plus the artifact
   of the immediately preceding phase. Do not reload every artifact; that is
   what makes a resumed session cost more than the original.
4. If the previous phase is complete but unapproved, stop at the gate and say
   which button advances.
5. If the previous phase is `blocked` or `escalated`, report the reason and what
   is needed. Do not retry it automatically.
6. Reuse the newest verification record in `session.md` when its tree state
   still matches `node .github/tools/verify/tree-state.mjs`; re-run only what
   the next phase's own contract requires. Warnings already recorded there are
   carried forward, not reopened.

Never restart a phase that is already complete. If its artifact is wrong, that
is a new decision to record in `session.md`, not a silent redo.

Session: ${input:id}

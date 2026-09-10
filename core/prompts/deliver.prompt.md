---
description: Open the pull request for the current branch, comment the review findings, and queue the validation pipeline.
version: 1.0.0
mode: agent
---

Hand this to `@azure-devops`.

Before anything else, run `node .github/tools/ado/preflight.mjs`. If it reports
a problem, stop and show the fix it names. Everything below assumes it passed.

Then, in order:

1. Read the session file for this branch. If the review phase did not return
   approve or approve-with-comments, stop and say so - there is nothing ready to
   open a pull request for.
2. On a track that has a specification, run
   `node .github/tools/spec/traceability.mjs --spec=<spec dir> --base=<target>`.
   A GAP is closed or explained in the body; an open clarification stops here.
   Patch, incident and refactor have none: the body says so and lists the
   tests that ran.
3. Write the body to `specs/<id>-<slug>/pr-body.md`, following the
   `ado-pull-request` skill. Four questions: what changed, why, what was
   actually verified, what was left out.
3. Open it as a **draft** and report the id and url.
4. If the review left findings, open one anchored thread per finding, following
   `ado-comment`. Blocker first.
5. Check whether the branch policy already queued a validation pipeline. Queue
   one only if nothing started, following `ado-pipeline`.
6. Report the run url and stop. Do not wait for the build.

Publishing the pull request and completing the merge are not yours to do. Offer
publishing as the next step; say plainly that completing the merge is a human
action.

Return the `deliver` handoff envelope from your contract.

Request: ${input:request}

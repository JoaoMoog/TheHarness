---
name: ado-pipeline
description: Decide which Azure DevOps pipeline to queue and read a failed run without pulling the whole log. Use when validating a change or diagnosing a red build.
version: 1.0.0
sfa: "scope: one pipeline run | format: a queue decision or a named list of failing tasks | audience: the engineer waiting on the build"
stacks: []
alwaysApply: false
---

# ado-pipeline

## Rules

Queue validation, never release. A CI or PR-validation pipeline builds and
tests; a release pipeline puts code in front of users. The second is Q4 and the
tooling refuses it, so if a run is genuinely needed, hand over the command and
let a human run it.

Do not queue what the branch policy will queue anyway. Opening the pull request
usually triggers validation on its own, and a manual run on top wastes an agent
and doubles the notifications. Check first; queue only if nothing started.

A failed run is diagnosed from the failing tasks, not from the log. A build log
is tens of thousands of tokens and almost all of it is noise from steps that
succeeded. `pipeline-status.mjs` returns the failing task names and their first
issues; that is normally enough to name the cause.

Do not wait in the session. A build takes minutes and the session is billed by
the turn. Report the run url and stop; check again when asked.

A red build that is red for reasons outside the change is a finding, not
something to fix quietly by rerunning until it passes.

Anti-patterns to refuse:

- queueing a pipeline whose name matches release, deploy, prod or hotfix
- rerunning a failed build without reading why it failed
- pulling full logs into the session
- treating a flaky test as a pass because the second run was green

## Workflow

1. Confirm which pipeline validates this repository:
   `az pipelines list --output table`. Name it in `specs/_context.md` so the
   next session does not have to look it up.
2. Check whether the pull request already started one. If it did, stop here.
3. Queue it, which will ask for confirmation:
   `node .github/tools/ado/pipeline-run.mjs --name="<pipeline>"`
4. Report the run id and url. Do not poll.
5. When asked for the result:
   `node .github/tools/ado/pipeline-status.mjs --id=<run id>`
6. On failure, name the failing tasks and their first issue, then say whether
   the cause is inside the change or outside it.

## Output

```
Queued: billing-api CI, run 48213
  https://dev.azure.com/contoso/Payments/_build/results?buildId=48213
Not waiting. Ask for the result when you want it checked.
```

On failure:

```
Run 48213 failed on feat/csv-export

  Run unit tests    Expected 200, received 403 in export.spec.ts:44
  Publish artifacts skipped, the previous task failed

The failure is inside this change: the export route is missing the permission
check the criterion requires. Not a flake, and not an infrastructure problem.
```

## Validation

- [ ] The pipeline queued is a validation pipeline, not a release.
- [ ] The branch policy was checked before queueing anything manually.
- [ ] The run url was reported and the session did not wait.
- [ ] A failure was diagnosed from named tasks, not from a full log.
- [ ] The cause was placed inside or outside the change, explicitly.

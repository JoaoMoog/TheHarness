# Structured session

Direct work stays in the current chat with zero subagents and no session file.
Structured work uses plan -> implement -> review -> done. Plan means one
planner invocation for all needed requirements, design and tasks, not three
independent model calls. The human approves the combined plan once. Existing
approval counts. Implementation and review then continue without phase gates.

Tracks: patch/incident use implement and review when scope is already clear;
fix/refactor/feature use plan, implement and review; spike uses plan only.
Sensitive actions still require explicit authorization before the action.
An incident also records a runbook and root-cause follow-up.

Use current branch; do not fetch or create a branch merely to open a session.
For concurrent work, do not mix changes in the same files; use isolated
checkouts when necessary. State files are local until the user commits.

## State and evidence

State lives in <specs>/<id>-<slug>/session.md. Copilot uses spec.md/plan.md;
Kiro uses requirements.md/design.md. Keep summaries <=120 words and paths.
Workers return harness-handoff with stage, status, artifacts and summary.
Tests run via tools/verify/run.mjs. Reuse only matching green records; missing
prerequisites or failing checks prevent validated completion. Record explicit
outcome via tools/verify/outcome.mjs. Never infer success from an agent name.

Two review rounds maximum. Send only blocker/major findings for correction;
re-review their evidence and changed delta. Warnings about pre-existing issues
are recorded but never fixed uninvited. Stop after two no-progress attempts.

## Legacy sessions

A legacy deliver phase resumes review and verification; preserve its history.
Legacy specify/tasks phases enter consolidated planning. Never map an old
phase directly to successful completion. No automated publication remains.

## End

Report local change, checks, warnings. No stage/commit/push/PR/pipeline/deploy.
Memory collection and consolidation are explicit /dream work only.

---
name: track-selection
description: Select a proportional workflow for structured work; localized changes remain direct.
version: 3.0.0
sfa: scope=workflow selection; format=track and rationale; audience=orchestrator
---

# Track selection

## Rules

Direct work is a clear localized objective with a targeted check, including a
new regression test. No session or subagent. File count is only a signal.
Sensitive scope requires authorization: auth, permissions, crypto, payments,
production schema/data or destructive operations. Existing approval counts.

## Workflow

1. Identify observable outcome, impacted components and sensitive scope.
2. Stay direct when sufficient. Otherwise select patch, fix, refactor, feature,
   incident or spike. No confirmation just to choose a track/current branch.
3. Patch/incident: implement -> review; fix/refactor/feature: plan -> implement
   -> review; spike: plan. One planning execution writes needed artifacts.
4. Obtain one approval of structured planning unless already authorized.
   Promote direct work if new scope/risk warrants it; state why.

## Output

workflow: direct | structured | sensitive
track: patch | fix | refactor | feature | incident | spike (structured only)
reason: concrete scope and risk
approval: existing | required-for-plan | required-for-sensitive-scope

## Validation

No agent for direct work; no per-document approval. Two review rounds max.
No automated stage, commit, push, PR, pipeline or deployment.

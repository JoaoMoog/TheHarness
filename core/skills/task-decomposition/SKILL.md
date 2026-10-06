---
name: task-decomposition
description: Decompose structured work into verifiable tasks during the same planning pass that produces requirements and design. Mark dependencies and sensitive scope.
version: 3.0.0
sfa: "scope: one structured change | format: tasks.md with files, checks and dependencies | audience: implementer and reviewer"
stacks: []
alwaysApply: false
---

# task-decomposition

## Rules

Requirements, design and tasks are produced in one planning execution. The
combined plan receives one approval before implementation. Existing approval
counts; neither a document nor a batch creates another approval gate.

A task can be implemented and checked independently. Name the files, behavior,
dependencies and verification. File count alone does not decide its complexity.

Mark sensitive work (auth, authorization, crypto, payments, production data or
destructive operations) with the exact confirmation scope required. Once that
scope is authorized, the agent may implement it within the authorization.
Publication remains manual.

Parallel eligibility is descriptive, not permission to spawn agents. Default
to sequential work; use only explicitly authorized parallel work within budget.

## Workflow

1. Read requirements and design from this planning pass.
2. Define tasks with stable ids, affected files and expected behavior.
3. Order dependencies; mark actual file overlap.
4. Name the check that proves each task and prerequisites it needs.
5. Mark sensitive scope and record existing authorization where applicable.
6. Return tasks together with requirements/design for the single plan approval.

## Output

| id | task | files | verify | dependency | sensitive scope |
|---|---|---|---|---|---|
| T1 | Handle an empty export | src/export.ts | regression for FR-001 | none | none |
| T2 | Preserve tenant permissions | src/query.ts | authorization regression | T1 | permission boundary |

## Validation

Every task names concrete files, observable behavior and a check. Dependencies
are ordered. Missing test prerequisites remain explicit. No per-task or
per-document approval is introduced. No publication step is present.

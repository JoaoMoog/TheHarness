# Prometeu Studio — specification set

Specifications for rebuilding the Prometeu Studio prototype (a pt-BR cost-and-budget
analytics studio) as a React front end with a Next.js backend, written in the
layout this harness expects so each one can be run as a `feature` session.

The prototype these specs describe is the `prometeu.zip` deliverable (`dist/index.html`,
`app.js`, `studio-engine.js`, `editor-pro.js`, `pro-core.js`). Its behaviour is the
ground truth for every functional requirement below; where the rewrite deliberately
departs from it, the spec's Problem or Out of scope section says so.

## Where things are

```
prometeu/specs/_context.md      planned repository inventory: stack, layout, sanctioned commands, landmines
prometeu/specs/_decisions.md    cross-cutting decisions every plan obeys (session 000-design)
prometeu/specs/NNN-slug/        spec.md · plan.md · tasks.md, one feature per directory
```

These files live here temporarily. When the application repository exists and the
harness is linked to it, move `prometeu/specs/*` to that repository's `specs/`
directory unchanged: the traceability tool resolves sibling specs from the parent of
the directory it is given, so nothing inside the files depends on the path.

## Requirement id scheme

Ids are global across the repository (the traceability tool maps every id it finds in
a test file to every spec that defines it), so they are **never restarted per spec**.

- `FR-NNNSS` / `NFR-NNNSS`: `NNN` is the spec directory number, `SS` the sequence within
  it. Spec 003 defines `FR-00301`, `FR-00302`, …, `NFR-00301`, …
- A `spec.md` never cites another spec's id (every id on any line of a `spec.md` is read
  as a requirement of that spec). Cross-references go by directory name.
- A test claims an id by starting its name with it: `it("FR-00301 selects rows by exact period", …)`.
  One test, one id.

## Order and lanes

| # | directory | depends on |
|---|---|---|
| 001 | app-skeleton | – |
| 002 | domain-schema | 001 |
| 003 | query-engine | 002 |
| 004 | formula-interpreter | 003 |
| 005 | authentication | 001 |
| 006 | workspaces-and-roles | 005 |
| 007 | analyses-and-sources-persistence | 002, 006 |
| 008 | file-import-and-data-page | 007 |
| 009 | svg-charts | 002, 003 |
| 010 | studio-canvas | 007, 009 |
| 011 | widget-editing | 010 |
| 012 | layout-drag-resize | 011 |
| 013 | filters-and-interactions | 010 |
| 014 | measures-and-parameters-ui | 004, 011 |
| 015 | versions-and-templates | 007, 010 |
| 016 | home-and-planning | 007 |
| 017 | presentation-and-export | 010, 013 |
| 018 | assistant-service | 003, 004, 006 |
| 019 | assistant-ui | 011, 018 |
| 020 | copilot-provider | 018 (blocked on open questions) |

Walking skeleton: 001 + 002 + 005 + 006 + 007 — sign in, land in a workspace with the demo
source, create an analysis from the library, open it, and have a document write round-trip
with a revision. It becomes visually complete at 010 and editable at 011.

After 007 three lanes can run in parallel (`loops/budgets.json` allows `maxParallel: 3`):
charts (009) as soon as 003 is done, home/planning (016) and the assistant service (018)
as soon as 007 is done. The studio chain 010 → 011 → 012 is serial.

## Running one spec as a session

1. Read `_context.md` and `_decisions.md`.
2. `/feature` (or `@orchestrator`) on the `feature` track; the spec, plan and tasks are
   already written, so the specify, plan and tasks phases are a read-and-confirm each.
3. Answer every `[NEEDS CLARIFICATION]` in the spec before the plan phase closes; the
   plan states the assumption it was written under, so a different answer changes the plan.
4. Implement one task at a time; every test name starts with the requirement id.
5. Before the pull request: `node .github/tools/spec/traceability.mjs --spec=specs/NNN-slug --base=<base>`.

Status of every spec is `draft` until a human marks it `approved`.

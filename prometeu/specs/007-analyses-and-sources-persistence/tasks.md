# Tasks: Analyses and sources persistence

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | migration `0003_analyses_sources` with down and data-loss note, Drizzle tables, source and title schemas, accent-folding helper | FR-00701, FR-00713 | `src/server/db/migrations/0003_analyses_sources.sql`, `0003_analyses_sources.down.sql`, `src/server/db/schema/analyses.ts`, `src/server/db/schema/index.ts`, `src/core/schema/source.ts`, `src/core/text/normalize.ts`, `src/core/text/normalize.test.ts` | migration applied on `DATABASE_URL_TEST`; FR-00713 schema test; normalize golden test | - | | Q4 |
| T2 | sources and analyses repositories, default analysis document, demo seed in workspace creation | FR-00702, FR-00703, FR-00704, FR-00705, FR-00706, FR-00709, FR-00710, FR-00711, FR-00714, FR-00715, NFR-00701, NFR-00702, NFR-00703 | `src/server/repos/sources.ts`, `src/server/repos/analyses.ts`, `src/core/schema/defaultAnalysisDocument.ts`, `src/server/repos/workspaces.ts`, `src/server/repos/sources.test.ts`, `src/server/repos/analyses.test.ts`, `src/core/schema/defaultAnalysisDocument.test.ts` | FR-00702 (90 rows after create), FR-00706, FR-00709, FR-00710 (concurrent writers), FR-00711, FR-00714, FR-00715 repository tests; NFR timings printed | T1 | | Q2 |
| T3 | sources, rows, create, get and replace-document routes | FR-00703, FR-00704, FR-00705, FR-00707, FR-00708, FR-00709, FR-00710, FR-00711 | `src/app/api/sources/route.ts`, `src/app/api/sources/[sourceId]/rows/route.ts`, `src/app/api/analyses/route.ts`, `src/app/api/analyses/[analysisId]/document/route.ts` | handler tests with plain `Request`s: 201, 200, 400 with field, 404, 409 with revision | T2 | | Q2 |
| T4 | rename, duplicate, soft delete and list/search routes; authorization sweep over every route of this spec | FR-00712, FR-00713, FR-00714, FR-00715, FR-00717, FR-00718, FR-00719, FR-00720 | `src/app/api/analyses/[analysisId]/route.ts`, `src/app/api/analyses/[analysisId]/duplicate/route.ts`, `src/app/api/analyses/route.ts`, `src/app/api/analyses.authz.test.ts` | FR-00717 test per route (Leitor → 403), FR-00718 (non-member → 404), FR-00719 cursor, FR-00720 `q` folding | T3 | | Q4 |
| T5 | library page: heading, search, grid and cards, new-analysis and delete dialogs, empty state | FR-00716, FR-00720, FR-00721, FR-00722, FR-00723, FR-00725, NFR-00704, NFR-00705 | `src/app/(shell)/dashboards/page.tsx`, `src/ui/library/LibraryPage.tsx`, `src/ui/library/LibraryDialogs.tsx`, `src/ui/library/EmptyLibrary.tsx`, `src/ui/library/library.module.css`, `src/ui/library/LibraryPage.test.tsx`, `src/ui/library/LibraryDialogs.test.tsx` | FR-00716, FR-00720, FR-00721 unit tests; FR-00722, FR-00723, FR-00725 e2e in T6 | T4 | | Q1 |
| T6 | `/` and `/dashboard` resolution, `/dashboard/[analysisId]` summary, 001 root-redirect assertion update, walking-skeleton e2e with axe | FR-00724, FR-00725, FR-00726, FR-00718, NFR-00705 | `src/app/page.tsx`, `src/app/(shell)/dashboard/page.tsx`, `src/app/(shell)/dashboard/[analysisId]/page.tsx`, `tests/e2e/007-analyses-and-sources-persistence.spec.ts`, `tests/e2e/001-app-skeleton.spec.ts` | FR-00724, FR-00725, FR-00726 e2e; FR-00718 not-found page; axe zero serious/critical | T5 | | Q1 |

T1 is Q4 because it applies a schema migration; T4 is Q4 because it wires
authorization across every route of this spec in one sitting and adds the delete.
The delete itself is soft (reversible by design), which is why T2's repository work
is Q2 rather than Q4. T3 is Q2 because handlers reach the database. Six tasks
because the authorization sweep (T4) is kept apart from the first routes (T3) so the
human review is one pass. T6 depends on T5 only for the shared `EmptyLibrary`
component it renders.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no upload or `/dados`, no
      versions, templates, scenarios, sharing or export, no canvas (the analysis page
      is a read-only summary), no assistant history, no hard delete, the seven open
      questions and the assumptions (messages dropped, no purge, any Editor may
      delete, titles not unique, no cap, indicators and waterfall as widgets, delete
      always shown) the plan took for them.

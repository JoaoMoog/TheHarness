# Tasks: Versions and templates

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | migration 0005 with down file, Drizzle table file, barrel export | FR-01503, FR-01511 | `src/server/db/migrations/0005_versions_templates.sql`, `0005_versions_templates.down.sql`, `src/server/db/schema/versions-templates.ts`, `src/server/db/schema/index.ts` | `npm run db:migrate` applies once; repository test sees both tables empty | - | | Q4 |
| T2 | version and template repositories: create/list/get/soft remove, cap refusals, create-from-template with emptied filters and period from rows | FR-01503, FR-01504, FR-01510, FR-01511, FR-01512, FR-01514, FR-01519, FR-01520, FR-01525 | `src/server/repos/versions.ts`, `versions.test.ts`, `src/server/repos/templates.ts`, `templates.test.ts` | the listed FR tests against `DATABASE_URL_TEST` | T1 | | Q1 |
| T3 | version routes: list (metadata only), create, snapshot, remove; `requireUser` + `assertCan`; validation and envelope | FR-01517, FR-01518, FR-01522, FR-01523, FR-01524, NFR-01501, NFR-01502 | `src/app/api/analyses/[analysisId]/versions/route.ts`, `src/app/api/analyses/[analysisId]/versions/[versionId]/route.ts`, `src/app/api/analyses/[analysisId]/versions/route.test.ts` | the listed FR/NFR route tests; timing asserted with a maximum document | T2 | | Q2 |
| T4 | template routes: list, create, remove, create-from-template | FR-01514, FR-01515, FR-01522, FR-01523, FR-01525 | `src/app/api/templates/route.ts`, `src/app/api/templates/[templateId]/route.ts`, `src/app/api/templates/[templateId]/analyses/route.ts`, `src/app/api/templates/route.test.ts` | the listed FR route tests | T2 | P | Q2 |
| T5 | studio dialogs, context bar button, store `restoreSnapshot` with undo and reader mode | FR-01501, FR-01502, FR-01505, FR-01506, FR-01507, FR-01508, FR-01509, FR-01521 | `src/ui/studio/VersionsDialog.tsx`, `VersionsDialog.module.css`, `VersionsDialog.test.tsx`, `src/ui/studio/ContextBar.tsx`, `src/ui/studio/store.ts` | the listed FR component tests with Testing Library and a fake fetch | T3 | | Q1 |
| T6 | library entry, `UseTemplateDialog`, e2e with axe and timing | FR-01513, FR-01516, NFR-01503, NFR-01504 | `src/ui/library/UseTemplateDialog.tsx`, `UseTemplateDialog.module.css`, `src/ui/library/LibraryPage.tsx`, `tests/e2e/015-versions-and-templates.spec.ts` | `npm run test:e2e` green; axe zero serious/critical; restore visible under 1 s | T4, T5 | | Q1 |

T1 is Q4 because it applies a schema migration: a human runs it. T3 and T4 are Q2
rather than Q4 because they reuse 006's matrix without adding a rule and their
deletion is a reversible soft delete; a human reviews them before merge. Six tasks
because the two aggregates have separate repositories and routes that a human should
review as separate diffs.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no diff between versions, no
      automatic versions, no template source binding, no retention job, the toolbar
      unchanged (both save actions live in the dialog as in the prototype), the six
      open questions and the assumptions the plan took for them.

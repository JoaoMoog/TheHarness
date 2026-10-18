# Implementation plan: Versions and templates

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: names are limited to 80 characters; the caps of 20 versions per analysis
and 20 templates per workspace stay as refusals; a restore does not create an
automatic version; a template stores no source; removal is a soft delete
(`deleted_at`) with no retention job; templates are visible to every member of the
workspace. A different answer changes the marked steps only.

## Approach

Two additive tables, `analysis_versions` and `workspace_templates`, each storing a
validated JSON snapshot next to its metadata, with list endpoints that return
metadata only and a snapshot endpoint used at restore or use time. Restore is a
client-side operation: the studio store replaces the document from the snapshot as
one undoable history entry and the existing autosave (planned in 010) persists it
with `revision`, so no new write path to the analysis is introduced; creating from a
template runs on the server because it needs the source's rows to pick the period
and must create the analysis atomically. Rejected: storing versions as rows of a
generic `snapshots` table shared with templates — the two have different owners
(analysis vs workspace), different caps and different authorization resources, and a
discriminator column would put both in every query. Rejected: a server-side
`POST …/restore` endpoint — it would bypass the store's history and the autosave's
conflict handling, giving restore a second concurrency semantic.

## Reuse found

- `src/core/schema/version.ts`, `src/core/schema/template.ts`, `src/core/schema/document.ts`
  (planned in 002-domain-schema): `VersionSchema`, `TemplateSchema`, `DocumentSchema`
  and the 80-character name rule; the snapshot is validated with them on save and again
  on restore/use.
- `src/server/auth/requireUser.ts` (planned in 005-authentication) and
  `src/server/authz/assertCan.ts`, `src/server/authz/matrix.ts` (planned in
  006-workspaces-and-roles): the matrix already grants `versions` and `templates` to
  editor and admin; this plan assumes the actions `version:save`, `version:restore`,
  `version:remove`, `template:save`, `template:use`, `template:remove` exist under those
  names and adds nothing to the matrix.
- `src/server/repos/analyses.ts`, `src/server/repos/sources.ts` (planned in 007):
  `createAnalysis(workspaceId, sourceId, title, document)` returning id and revision 1,
  `getAnalysis`, `listSources`, `getSourceRows`; used by create-from-template.
- `src/server/http/envelope.ts`, `src/server/http/validate.ts` (planned in 007): error
  envelope, `notFound`, `forbidden`, body parsing with field paths.
- `src/ui/shell/Modal.tsx`, `ToastProvider.tsx` (planned in 001): dialogs and toasts.
- `src/ui/studio/store.ts` (planned in 010): `replaceDocument(document)` used by the
  conflict reload; restore reuses it if it records a history entry, otherwise adds
  `restoreSnapshot`. `src/ui/studio/ContextBar.tsx` (planned in 010, extended by 013 and
  014 with page filters and `ƒ Medidas`) receives the `Versões e modelos` button.
- `src/ui/library/LibraryPage.tsx` (planned in 007): receives `Novo a partir de modelo`.
- Genuinely new: the two tables and migration, both repositories, five route files,
  the two dialog files and the e2e file.

## Files

| File | Change |
|---|---|
| `src/server/db/migrations/0005_versions_templates.sql` | created: `analysis_versions` (id, analysis_id, workspace_id, name, snapshot jsonb, created_by, created_at, deleted_at) and `workspace_templates` (id, workspace_id, name, document jsonb, page_count, created_by, created_at, deleted_at); indexes on (analysis_id, created_at) and (workspace_id, created_at) |
| `src/server/db/migrations/0005_versions_templates.down.sql` | created: drops both tables; data-loss note: every saved version and template is lost |
| `src/server/db/schema/versions-templates.ts` | created: Drizzle definitions of the two tables |
| `src/server/db/schema/index.ts` | modified: exports the two new tables (shared file created in 001) |
| `src/server/repos/versions.ts` | created: `listVersions(analysisId)`, `getVersionSnapshot`, `createVersion` (counts live versions, refuses at 20), `removeVersion` (soft) |
| `src/server/repos/templates.ts` | created: `listTemplates(workspaceId)`, `getTemplate`, `createTemplate` (refuses at 20), `removeTemplate` (soft), `createAnalysisFromTemplate` (copies document, empties filters, area `Todas as áreas`, period = latest month in rows) |
| `src/app/api/analyses/[analysisId]/versions/route.ts` | created: GET list (metadata), POST create |
| `src/app/api/analyses/[analysisId]/versions/[versionId]/route.ts` | created: GET snapshot, DELETE remove |
| `src/app/api/templates/route.ts` | created: GET list for the current workspace, POST create |
| `src/app/api/templates/[templateId]/route.ts` | created: DELETE remove |
| `src/app/api/templates/[templateId]/analyses/route.ts` | created: POST create-from-template `{ title, sourceId }` |
| `src/ui/studio/VersionsDialog.tsx`, `VersionsDialog.module.css` | created: the `Versões e modelos` dialog with both lists, the `Salvar versão` / `Salvar modelo` form (default name, 80-char rule), the restore confirmation and reader mode |
| `src/ui/studio/ContextBar.tsx` | modified: adds the `Versões e modelos` button (shared file planned in 010) |
| `src/ui/studio/store.ts` | modified: `restoreSnapshot(snapshot)` as one history entry, clearing selection and cross-filter (shared file planned in 010) |
| `src/ui/library/UseTemplateDialog.tsx`, `UseTemplateDialog.module.css` | created: `Criar análise a partir de modelo` form, used from the studio dialog and the library |
| `src/ui/library/LibraryPage.tsx` | modified: `Novo a partir de modelo` entry (shared file planned in 007) |
| `tests/e2e/015-versions-and-templates.spec.ts` | created: save, list, restore + undo, remove, template round trip, reader mode, axe |

## Contracts

- `GET /api/analyses/{analysisId}/versions` → `{ data: [{ id, name, createdAt, createdBy, pageCount }], nextCursor }`, newest first; no snapshot in the list.
- `POST /api/analyses/{analysisId}/versions` body `{ name, snapshot: { document, title, period, area, categories } }` → `201 { data: { id, name, createdAt, pageCount } }`; `400 validation_failed` with `field`; `409 limit_reached` with `Limite de 20 versões por análise. Remova uma versão para salvar outra.`; `403 forbidden`; `404 not_found`.
- `GET /api/analyses/{analysisId}/versions/{versionId}` → `{ data: { id, name, snapshot } }`; `DELETE` → `204`; both `404` when removed or foreign.
- `GET /api/templates` → `{ data: [{ id, name, createdAt, createdBy, pageCount }], nextCursor }` for the current workspace; `POST /api/templates` body `{ name, document }` → `201`; `409 limit_reached` with `Limite de 20 modelos por workspace. Remova um modelo para salvar outro.`.
- `DELETE /api/templates/{templateId}` → `204`.
- `POST /api/templates/{templateId}/analyses` body `{ title, sourceId }` → `201 { data: { analysisId, revision: 1 } }`; `400 source_empty` with `Importe uma fonte com dados válidos primeiro.`.
- Store: `restoreSnapshot({ document, title, period, area, categories })` pushes one history entry and marks the document dirty so autosave sends it with the current `revision`.
- Nothing breaking: no existing endpoint or schema changes shape.

## Order of work

1. Confirm the reused files exist as described (schemas of 002, `requireUser`/`assertCan`
   and the six action names of 006, repositories and envelope of 007, `store.ts`,
   `ContextBar.tsx`, `LibraryPage.tsx`, `Modal.tsx`); if not, return blocked. Green:
   nothing changes.
2. Migration 0005 with its down file, Drizzle table file, barrel export. Green:
   `npm run db:migrate` applies it once; a repository test sees both tables empty.
3. Repositories with tests against `DATABASE_URL_TEST`: create/list/get/remove for
   both, the cap refusals, soft-delete filtering, create-from-template with filters
   emptied and period from rows. Green: FR-01503, FR-01504, FR-01510, FR-01511,
   FR-01512, FR-01514, FR-01519, FR-01520, FR-01525 repository tests pass.
4. Version routes with `requireUser` + `assertCan`, validation with the 002 schemas,
   envelope errors. Green: route tests for FR-01517, FR-01518, FR-01522, FR-01523,
   FR-01524 and NFR-01502 (metadata only) pass.
5. Template routes including create-from-template. Green: route tests for FR-01514,
   FR-01515 (response), FR-01525 pass.
6. Studio dialogs, context bar button, store `restoreSnapshot` with undo, reader mode.
   Green: component tests for FR-01501, FR-01502, FR-01505, FR-01506, FR-01507,
   FR-01508 (autosave sends revision after restore), FR-01509, FR-01521 pass.
7. Library entry, `UseTemplateDialog`, e2e file including axe and the timing checks
   of NFR-01501 and NFR-01503. Green: `npm run test:e2e` passes; traceability shows
   every id covered.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| 010's store has no `replaceDocument` that records history, so restore would not be undoable | FR-01507 fails | step 1 checks; `restoreSnapshot` pushes its own history entry using the store's snapshot helper |
| Dashboard-level period/area/categories live outside the document in 002/007, so a snapshot cannot be restored through the document write alone | FR-01506/FR-01508 need a second write (rename/filters) | step 1 checks where they live; if outside, restore applies the document then the metadata through 007's rename/filters endpoint, with one undo entry covering both |
| Two members save the 20th version concurrently | 21 versions stored | the cap is counted inside the insert transaction with the analysis row locked |
| Snapshot of an older `schemaVersion` fails validation years later | restore refused, version unusable | FR-01509 refuses with the field; 002's open question on repairing old documents decides whether a migration on read is added later |
| Route-group paths are not captured by the traceability planned-file regex | false "unrequested change" lines | known landmine in `_context.md`; explained once in the PR body |
| A template copied to a source lacking a dimension used by widgets | empty charts in the new analysis | the engine's empty state `Sem dados` renders; the note in FR-01513 warns that filters are reset |

## Human approval required

Step 2 applies a schema migration (Q4). Steps 4 and 5 call `assertCan` and perform
soft deletion of versions and templates; they add no authorization rule and the
deletion is reversible, so they run as Q2 with review before merge. No
cryptography or payment.

## Verification

```
npm ci && docker compose up -d db && npm run db:migrate
npm run lint && npm test
npx vitest run src/server/repos/versions.test.ts src/server/repos/templates.test.ts
npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/015-versions-and-templates
```

Observable behaviour: sign in as an Editor, open an analysis, edit a title, save a
version named `Antes da reunião`, change the layout, restore the version, press undo
and see the changed layout return; save the analysis as a template, create
`Análise · teste` from it on the demo source and land on a first page whose filters
are empty and whose period is the demo's last month; sign in as a Leitor and see both
lists without any action. A pass: every command exits 0, the 21st version is refused
with the limit message, and the matrix shows every FR/NFR with at least one test.

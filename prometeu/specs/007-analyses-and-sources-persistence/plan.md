# Implementation plan: Analyses and sources persistence

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: assistant messages are not persisted (019-assistant-ui decides); soft-deleted
analyses are kept without a purge; any Editor may rename or delete any analysis of the
workspace; titles are not unique; no cap on analyses per workspace; the default
document includes four indicator widgets and a waterfall widget on `Visão geral` in
addition to the three titled widgets, so the canvas renders only widgets; the delete
action is always shown. A different answer changes the marked steps only.

## Approach

Three tables (`sources`, `source_rows`, `analyses`) with the document as `jsonb` and an
integer `revision`; repositories in `src/server/repos` wrap every write in a
transaction and compare the revision in the `UPDATE … WHERE revision = $n` itself, so
the 409 is decided by the row count, not by a read-then-write. Search folds accents in
the application into a `title_normalized` column maintained on every title write.
Rejected: PostgreSQL `unaccent` for search — an extension needing superuser rights on
some hosts, for a 1,000-title workspace that the normalized column serves with a
plain index. Rejected: storing rows as one `jsonb` blob per source — the rows endpoint
would work, but 008's validation errors and the future SAP kind want row-level access.

## Reuse found

- `requireUser`, `HttpError`, `jsonError` (planned in 005-authentication);
  `assertCan`, `requireWorkspace`, `parseBody` (planned in 006-workspaces-and-roles).
- `createWorkspace` in `src/server/repos/workspaces.ts` (planned in
  006-workspaces-and-roles): this plan modifies it to seed the demonstration source in
  the same transaction.
- `DocumentSchema`, `RowSchema`, `AnalysisSchema`, `defaultDocument()` and `newWidget`
  (planned in 002-domain-schema, `src/core/schema`), the demonstration generator
  `demoRows()` (`src/core/demo/rows.ts`, 90 rows) and `periodLabel` from
  `src/core/format`.
- `Modal.tsx`, `Toast.tsx`, `useToast` (planned in 001-app-skeleton); the placeholder
  pages `dashboards/page.tsx` and `dashboard/page.tsx` and `src/app/page.tsx`.
- Genuinely new: the three tables, repositories for sources and analyses, the
  default-document builder, every analysis and source route, the library UI and the
  read-only analysis page.

## Files

| File | Change |
|---|---|
| `src/server/db/migrations/0003_analyses_sources.sql`, `0003_analyses_sources.down.sql` | created: `sources(id, workspace_id, name, kind, row_count, created_by, created_at, deleted_at)`, `source_rows(id, source_id, position, date, area, category, actual numeric(14,2), budget numeric(14,2))` with index `(source_id, date, area, category)`, `analyses(id, workspace_id, source_id, title, title_normalized, period, area, document jsonb, revision int, created_by, created_at, updated_at, deleted_at)` with index `(workspace_id, updated_at desc)`; down drops the three tables — data loss: every analysis, source and row |
| `src/server/db/schema/analyses.ts` | created: Drizzle definitions of the three tables |
| `src/server/db/schema/index.ts` | modified: export `analyses` |
| `src/core/schema/source.ts` | created: `SourceKindSchema` (`"demo" \| "file"`, extended by 008), `SourceNameSchema` (1–120), `AnalysisTitleSchema` (trim, 1–100), `ReplaceDocumentSchema` (`{ revision, document }`) |
| `src/core/text/normalize.ts` | created: `normalizeText` (lowercase, NFD, strip combining marks), pure |
| `src/server/repos/sources.ts` | created: `createSource(tx, { workspaceId, name, kind, rows })`, `listSources`, `getSource`, `getSourceRows`, `seedDemoSource(tx, workspaceId)` |
| `src/server/repos/workspaces.ts` | modified: `createWorkspace` calls `seedDemoSource` in its transaction |
| `src/server/repos/analyses.ts` | created: `createAnalysis(workspaceId, sourceId, title?, document?)`, `getAnalysis`, `listAnalyses(workspaceId, { q, cursor, limit })`, `countAnalyses`, `replaceDocument(id, revision, document)` (conditional update → 409), `renameAnalysis`, `duplicateAnalysis`, `softDeleteAnalysis`, `mostRecentAnalysis(workspaceId)` |
| `src/core/schema/defaultAnalysisDocument.ts` | created: `defaultAnalysisDocument()` — starts from 002's `defaultDocument()` and adds the prototype's three pages and widgets through `newWidget` (marked: indicator/waterfall assumption) |
| `src/app/api/sources/route.ts` | created: `GET` list for the current workspace |
| `src/app/api/sources/[sourceId]/rows/route.ts` | created: `GET` full bounded collection |
| `src/app/api/analyses/route.ts` | created: `GET` list with `q`, `cursor`, `limit`; `POST { sourceId }` create |
| `src/app/api/analyses/[analysisId]/route.ts` | created: `GET`, `PATCH { title }`, `DELETE` (soft) |
| `src/app/api/analyses/[analysisId]/document/route.ts` | created: `PUT { revision, document }` |
| `src/app/api/analyses/[analysisId]/duplicate/route.ts` | created: `POST` |
| `src/app/page.tsx` | modified: redirect to the most recent analysis or render the empty state (was: redirect to `/dashboard`) |
| `src/app/(shell)/dashboard/page.tsx` | modified: same resolution as `/` |
| `src/app/(shell)/dashboard/[analysisId]/page.tsx` | created: read-only summary rendered inline (FR-00726; 010 replaces it with the studio), `notFound()` on 404 |
| `src/app/(shell)/dashboards/page.tsx` | modified: server component loading the first page of analyses and sources, renders `LibraryPage` |
| `src/ui/library/LibraryPage.tsx` | created: client island with heading, search field, grid and cards; search filters client-side over the loaded page and asks the server when `q` changes for workspaces beyond one page |
| `src/ui/library/LibraryDialogs.tsx` | created: `NewAnalysisDialog` (source chooser) and `DeleteAnalysisDialog` (confirm) over `Modal` |
| `src/ui/library/EmptyLibrary.tsx`, `library.module.css` | created: the empty state used by `/dashboards`, `/` and `/dashboard`; styles |
| `src/server/repos/analyses.test.ts`, `sources.test.ts` | created: revision conflict, validation, duplicate, soft delete, seed of 90 rows, ordering |
| `src/app/api/analyses.authz.test.ts` | created: every route of this spec called as Leitor (403 on writes) and as non-member (404) |
| `tests/e2e/001-app-skeleton.spec.ts` | modified: the root-redirect assertion now expects `/dashboard/<id>` or the empty state |
| `src/core/text/normalize.test.ts`, `src/core/schema/defaultAnalysisDocument.test.ts` | created: accent folding; default document valid under `DocumentSchema` with the required pages and titles |
| `src/ui/library/LibraryPage.test.tsx`, `LibraryDialogs.test.tsx` | created: card content, search empty state, source chooser, confirm before delete |
| `tests/e2e/007-analyses-and-sources-persistence.spec.ts` | created: the walking skeleton — sign in, workspace with the demo source, create, open, rename, duplicate, delete, 409 round trip, axe |

## Contracts

- `GET /api/sources` → `{ data: [{ id, name, kind, rowCount, createdAt }], nextCursor: null }`.
- `GET /api/sources/:id/rows` → `{ data: Row[], nextCursor: null }` where `Row` is
  002's row type; bounded by the source's row cap (008's open question).
- `GET /api/analyses?q=&cursor=&limit=` → `{ data: [{ id, title, sourceId, sourceName, sourceKind, period, area, rowCount, updatedAt }], nextCursor }`.
- `POST /api/analyses { sourceId }` → 201 `{ data: { id, revision: 1, ... } }`; 404 for a
  foreign or empty source.
- `GET /api/analyses/:id` → `{ data: { id, title, sourceId, sourceName, period, area, revision, updatedAt, document } }`.
- `PUT /api/analyses/:id/document { revision, document }` → `200 { data: { revision } }`;
  `409 { error: { code: "revision_conflict", message: "Esta análise foi alterada em outro lugar. Recarregue para continuar." }, revision: <current> }`;
  `400 { error: { code: "invalid", message, field: "document.pages[2].widgets[0]" } }`.
- `PATCH /api/analyses/:id { title }` → 200; 400 `field: "title"`.
- `POST /api/analyses/:id/duplicate` → 201 with the new analysis.
- `DELETE /api/analyses/:id` → 204; subsequent `GET` → 404.
- `getSourceRows(sourceId): Promise<Row[]>` is the one read every consumer (canvas,
  export, assistant) uses; `kind` is never a parameter.
- `createWorkspace` now also inserts one source and 90 rows; its signature is unchanged
  (not breaking for 006's callers).
- `SourceKindSchema` is the extension point 008 widens; consumers read `kind` only for
  labels (`Exemplo SAP` / `Dados importados`).
- Breaking: `src/app/page.tsx` no longer redirects to `/dashboard` unconditionally
  (001's FR for the root redirect is superseded; its e2e assertion is updated in step 6).

## Order of work

1. Confirm the reused files exist as described (`requireUser`, `assertCan`,
   `requireWorkspace`, `parseBody`, `repos/workspaces.ts`, `src/core/schema`
   document and row schemas, `src/core/demo`, `schema/index.ts`, the placeholder
   pages); if not, return blocked. Green: tree unchanged and passing.
2. Migration `0003_analyses_sources`, Drizzle definitions, `source.ts` schemas,
   `normalizeText`. Green: migration applies on the test database; normalize tests.
3. Repositories for sources and analyses, default-document builder, demo seed wired
   into `createWorkspace`. Green: repository tests — a new workspace has one source
   with 90 rows (FR-00702); `replaceDocument` with a stale revision returns the
   conflict and leaves the row unchanged (FR-00710); invalid document rejected with a
   path (FR-00711); duplicate appends ` · cópia` (FR-00714); soft delete hides and
   404s (FR-00715). (Marked: default document depends on the indicator question.)
4. Sources, rows, create, get and replace routes with `assertCan`. Green: handler tests
   with plain `Request`s for 201/200/400/404/409 and the 401 contract test from 005.
5. List, search, rename, duplicate and delete routes; the authorization sweep: every
   route in this spec asserted for Leitor → 403 and non-member → 404. Green: handler
   tests for FR-00712–FR-00719, FR-00717 per route.
6. Library page and dialogs, `/dashboard/[analysisId]` summary, `/` and `/dashboard`
   resolution, update of 001's root-redirect e2e assertion, the walking-skeleton e2e
   and axe. Green: `npm run test:e2e` passes; NFR-00705 zero serious/critical.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Revision compared in application code between a read and a write | lost update under concurrency | the conditional `UPDATE … WHERE id = $1 AND revision = $2`; 409 when zero rows updated; a test runs two writers concurrently |
| Demo seed inside `createWorkspace` doubles workspace creation time and fails 006's tests that count rows | flaky 006 tests | seed is 91 inserts in one transaction (< 50 ms measured); 006's tests assert memberships, not sources |
| `jsonb` document larger than 002's cap accepted by Postgres | bloated rows, slow lists | validation with `DocumentSchema` before every write; list queries never select `document` |
| Accent folding in the application diverges from what the prototype's `normalized()` did | search misses | `normalizeText` ports the same NFD + `[̀-ͯ]` strip; golden test with `Visão`, `Operações` |
| `/` redirect races the no-workspace state from 006 | redirect loop | `requireWorkspace` runs first; empty state rendered inside the shell, never a redirect to itself |
| Route-group paths not captured by the traceability planned-file regex | false "unrequested change" lines | known landmine; explained once in the PR body |

## Human approval required

Step 2 applies a schema migration and step 5 wires authorization across every route
and adds the soft delete; a human runs those two with the agent assisting. Steps 3, 4
and 6 run and are reviewed before merge.

## Verification

```
npm ci
docker compose up -d db && npm run db:migrate
npm run lint && npm test && npm run build
AUTH_TEST_LOGIN=1 npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/007-analyses-and-sources-persistence
```

A pass: every command exits 0; after signing in, `GET /api/sources` lists
`SAP S/4HANA · demonstração` with `rowCount: 90`; `POST /api/analyses` returns revision
1 and the title `Visão de custos · Tecnologia`; a `PUT` with revision 1 returns 2 and a
second `PUT` with revision 1 returns 409 carrying `revision: 2`; `/` lands on
`/dashboard/<that id>`; the library shows the card, `Duplicar` adds ` · cópia`, and
`Excluir dashboard` removes it after the dialog.

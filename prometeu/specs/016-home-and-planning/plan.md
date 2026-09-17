# Implementation plan: Home and planning

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: the parser's grammar is exactly the prototype's word list; no cap on
scenarios; scenarios are per workspace; the base analysis for planning and for the
governance lineage is the member's most recently opened analysis (falling back to the
workspace's most recently updated one); a Leitor may simulate. A different answer
changes the marked steps only.

## Approach

Put the two pieces of logic that must be identical everywhere in `src/core`: the
prompt parser (a pure function from prompt text plus the source's areas and months to
an intent) and the scenario arithmetic (bucketing and sums over rows), both tested with
golden values. The home page then needs no new endpoint: the client fetches the
source's rows through 007's rows endpoint, parses, and creates the analysis through
007's create endpoint with the default document and the parsed filters. Scenarios get
one additive table and two route files; the planning page computes live numbers on the
client from the rows it already has, and the server recomputes the stored numbers from
the same core function before persisting so a client cannot save arithmetic it did not
do. Rejected: a `POST /api/home/ask` endpoint that parses on the server — it would
duplicate 007's creation path and add a second place where analyses are born.
Rejected: trusting the client's computed `value`/`delta` on save — the server would be
storing unverified numbers; recomputing costs one pass over at most 5000 rows.

## Reuse found

- `src/core/schema/scenario.ts`, `src/core/schema/analysis.ts`, `src/core/schema/document.ts`
  (planned in 002-domain-schema): `ScenarioSchema` with the 100-character name and the
  three assumption values in −30..30; the default document factory.
- `src/core/engine/select.ts` (planned in 003-query-engine): `selectRows(rows, { period, area, categories })`
  for the base selection; `src/core/format` for `money` and `compact` (pt-BR currency,
  `R$ 1,20 mi` / `R$ 850 mil`).
- `src/core/demo` (planned in 002): the demo months are the parser's month test fixture.
- `src/server/auth/requireUser.ts` (005), `src/server/authz/assertCan.ts` and the matrix
  (006): the matrix already grants `scenarios` to editor and admin; this plan assumes
  the actions `scenario:save` and `scenario:remove` and adds nothing.
- `src/server/repos/analyses.ts` (007): `createAnalysis`, `listAnalyses` ordered by
  `updated_at`, and the "last opened" marker used by `/` redirect; `GET /api/sources/{id}/rows`
  and `POST /api/analyses` (007) are called by the home page.
- `src/ui/shell/Modal.tsx`, `ToastProvider.tsx` (001); `src/ui/studio/Lineage.tsx`
  (planned in 013-filters-and-interactions as `Rastro da análise`) rendered on the
  governance page; `src/ui/governance/GovernancePage.tsx` (planned in 006) is the page
  it is placed in.
- Genuinely new: `src/core/scenario`, `src/core/prompt`, the scenarios table and
  migration, its repository and routes, the home and planning components.

## Files

| File | Change |
|---|---|
| `src/core/scenario/index.ts`, `index.test.ts` | created: `bucketOf(category)`, `computeScenario(rows, assumptions)` → `{ base, budget, value, delta, balance }`; golden tests over the demo rows |
| `src/core/prompt/parse.ts`, `parse.test.ts` | created: `parsePrompt(text, { areas, months })` → `{ kind: 'scenario', preset?: -10 } \| { kind: 'analysis', area?, period? } \| { kind: 'unknown' } \| { kind: 'empty' }`; `normalize` (lower-case, strip accents); month names `janeiro`…`dezembro` |
| `src/server/db/migrations/0006_scenarios.sql` | created: `scenarios` (id, workspace_id, analysis_id nullable, name, base, budget, value, delta, area, period, assumptions jsonb, created_by, created_at, deleted_at); index on (workspace_id, created_at) |
| `src/server/db/migrations/0006_scenarios.down.sql` | created: drops the table; data-loss note: every saved scenario is lost |
| `src/server/db/schema/scenarios.ts` | created: Drizzle definition |
| `src/server/db/schema/index.ts` | modified: exports `scenarios` (shared file created in 001) |
| `src/server/repos/scenarios.ts`, `scenarios.test.ts` | created: `listScenarios(workspaceId)`, `createScenario`, `removeScenario` (soft) |
| `src/app/api/scenarios/route.ts`, `route.test.ts` | created: GET list for the current workspace; POST create recomputing the numbers from rows with `src/core/scenario` |
| `src/app/api/scenarios/[scenarioId]/route.ts` | created: DELETE remove |
| `src/ui/home/HomePage.tsx`, `HomePage.module.css` | created: eyebrow, greeting, composer, chips, live region, `Continue de onde parou` |
| `src/ui/home/useAskHome.ts`, `useAskHome.test.ts` | created: submit flow — parse, reader guard, empty-source guard, create through 007, navigate; scenario intent → planning with preset |
| `src/app/(shell)/inicio/page.tsx` | modified: replaces the 001 placeholder with `HomePage` fed by recent analyses (shared file planned in 001) |
| `src/ui/planning/PlanningPage.tsx`, `PlanningPage.module.css` | created: heading, hero, live results, saved table, reader mode, empty states |
| `src/ui/planning/ScenarioSliders.tsx`, `SaveScenarioDialog.tsx` | created: the three controls with keyboard steps; the save form |
| `src/app/(shell)/planejamento/page.tsx` | modified: replaces the 001 placeholder, loads the base analysis and its rows on the server (shared file planned in 001) |
| `src/ui/governance/GovernancePage.tsx` | modified: renders `Lineage` for the base analysis under the roles table (shared file planned in 006) |
| `tests/e2e/016-home-and-planning.spec.ts` | created: chips, parser paths, reader messages, sliders by keyboard, save/list/remove, governance lineage, axe |

## Contracts

- `parsePrompt(text, ctx)` is pure and total: never throws, returns `{ kind: 'empty' }` for whitespace.
- `computeScenario(rows, { infra, people, services })` returns numbers only; formatting is the caller's job.
- `GET /api/scenarios` → `{ data: [{ id, name, base, budget, value, delta, area, period, assumptions, createdBy, createdAt }], nextCursor }`, newest first.
- `POST /api/scenarios` body `{ name, analysisId, assumptions: { infra, people, services } }` → `201 { data: scenario }`; the server selects the analysis's rows, recomputes base/budget/value/delta and stores area and period from the analysis; `400 validation_failed` with `field` (`name` empty, over 100, assumption outside −30..30); `400 selection_empty` with `Nenhum dado no recorte da análise base. Ajuste os filtros da análise ou importe uma fonte.`; `403 forbidden`; `404 not_found`.
- `DELETE /api/scenarios/{scenarioId}` → `204`; `404` when removed or foreign.
- Home creation reuses `POST /api/analyses` (007) with `{ sourceId, title, document }` where the document is the default document with dashboard-level `period`, `area` set by the parser; no new endpoint.
- Nothing breaking.

## Order of work

1. Confirm the reused files exist as described (002 schemas, `selectRows`, `money`/`compact`,
   `requireUser`/`assertCan` with the two scenario actions, 007's `createAnalysis`, rows
   and create endpoints, `Lineage.tsx`, `GovernancePage.tsx`, the two placeholder
   pages); if not, return blocked. Green: nothing changes.
2. `src/core/scenario` and `src/core/prompt` with golden tests. Green: FR-01606,
   FR-01607, FR-01608 (parse result), FR-01609 (unknown), FR-01610, FR-01611, FR-01617,
   FR-01618, NFR-01602 tests pass; the core lint rule stays clean.
3. Migration 0006 with its down file, table file, barrel export, repository with tests.
   Green: `npm run db:migrate` applies once; FR-01623 (stored fields), FR-01625 repository
   tests pass.
4. Scenario routes with `requireUser` + `assertCan`, recompute on save, envelope errors.
   Green: FR-01627, FR-01628, FR-01629 (server side), FR-01631 route tests pass.
5. Home page and `useAskHome`, replacing the `/inicio` placeholder. Green: FR-01601 to
   FR-01605, FR-01609 (callout), FR-01612, FR-01613, FR-01614, FR-01615 component tests
   with a fake fetch pass.
6. Planning page, sliders, results, save dialog, reader and empty states, replacing the
   `/planejamento` placeholder. Green: FR-01616, FR-01619 to FR-01622, FR-01624,
   FR-01626, FR-01629, FR-01630, NFR-01601 component tests pass.
7. Governance lineage placement and the e2e file with axe and NFR-01603 timing. Green:
   FR-01632 test and `npm run test:e2e` pass; traceability shows every id covered.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The prototype defaults the area to `rows[0].area`, which depends on row order of an imported source | FR-01610 flaky on imports | the rows endpoint returns rows in stored order; the parser takes `areas[0]` from that order and the test pins it |
| Month names map to a year only through the source's months | a prompt naming `setembro` on a source with two Septembers | FR-01611 picks the most recent; tested with a two-year fixture |
| "Most recently opened analysis" is tracked by 007 only for the `/` redirect and may be per workspace, not per member | wrong base on planning | step 1 checks; fallback to most recently updated analysis of the workspace is coded regardless |
| Live recompute on every slider `input` event over 5000 rows | NFR-01601 missed on slow machines | bucket sums are computed once per selection; a slider change is three multiplications |
| 013's `Lineage` needs the studio store as a prop source | governance page cannot render it outside the studio | step 1 checks its props; if it reads the store, wrap the analysis document in a store instance on the page |
| Route-group paths are not captured by the traceability planned-file regex | false "unrequested change" lines | known landmine in `_context.md`; explained once in the PR body |

## Human approval required

Step 3 applies a schema migration (Q4). Step 4 calls `assertCan` and soft-deletes
scenarios; it adds no authorization rule and the deletion is reversible, so it runs
as Q2 with review before merge. No cryptography or payment.

## Verification

```
npm ci && docker compose up -d db && npm run db:migrate
npm run lint && npm test
npx vitest run src/core/scenario src/core/prompt
npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/016-home-and-planning
```

Observable behaviour: as an Editor, click `Custos da minha área` and land in the studio
on `Visão de custos · Tecnologia` for the demo's last month; type `Simule uma redução
de custos de 10%` and land on `/planejamento` with all three sliders at `-10%`; type
`bom dia` and read the guided-examples callout; move `Pessoas` to `-30%` with the
keyboard and watch the result and `Saldo sobre orçamento` change; save `Cenário 1`,
see it in the table, remove it; open `/governanca` and read `Rastro da análise` for the
same analysis. As a Leitor, the sliders move and `Salvar cenário` is absent. A pass:
every command exits 0 and the matrix shows every FR/NFR with at least one test.

# Implementation plan: Studio canvas

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: a pending save is flushed with `keepalive` on unload and navigation
is not blocked; the explorer search matches analysis titles only; a failed
save waits for the next change (no timer-based retry, no offline state); the
refusal toasts are `Limite de 20 páginas por análise.` and `Limite de 100
componentes por análise.` A different answer changes the marked steps only.

## Approach

One zustand store per open analysis, created by the client root the server
page renders, holding the document, revision, selection, active page,
whole-document undo/redo snapshots and the save state; every mutation goes
through one `commit` action that validates with the 002 schema before it
touches state, so the canvas can never hold an invalid document. Autosave is a
subscriber on that store with a 1 s debounce that sends the whole document and
the revision, and maps 409 to the conflict state. Chrome islands (undo/redo,
save indicator, page tree, search, panel header) read the store through a
context placed in the shell layout, so the 001 chrome stays server-rendered
and only the moving parts hydrate. Rejected: command-pattern undo (per-action
inverse operations) — more code and more bugs than 30 JSON snapshots of a
document capped at 100 widgets. Rejected: React Query or SWR around the
document — there is exactly one document and no cache to invalidate; the
store already is the cache.

## Reuse found

- `src/app/(shell)/layout.tsx`, `src/ui/shell/Header.tsx`, `Explorer.tsx`,
  `Footer.tsx`, `PropertyPanel.tsx`, `Toolbar.tsx`, `Toast.tsx`, `Modal.tsx`
  (planned in 001-app-skeleton): the chrome this spec fills; the toast API
  `useToast().show(text)` and `<Modal open title onClose>`.
- `src/core/schema` (planned in 002-domain-schema): `documentSchema`, `Document`,
  `Page`, `Widget`, limits `MAX_PAGES = 20`, `MAX_WIDGETS = 100`, `MAX_PAGE_NAME
  = 60`, `MAX_DOCUMENT_BYTES`, and the document-internal id generator. Assumed:
  the dashboard-level filters `{ area, period, categories }` live on the
  document root; if 002 put them on the analysis row, step 3 reads them from
  there and `commit` still owns them.
- `src/core/engine` (planned in 003-query-engine): `chartData`, `resolveFilters`,
  `metrics(rows, dashboardFilters)` for the indicator strip, `periodLabel`.
- `src/core/format` (planned in 002-domain-schema): `formatCurrency` (`R$
  1.234.567`) and percent to one decimal for the strip.
- `src/ui/charts` (planned in 009-svg-charts): `rendererFor(type)`, `Frame`'s
  custom properties `--span`, `--card-height`.
- `src/server/auth` `requireUser` (planned in 005-authentication),
  `src/server/authz` `assertCan(actor, action, resource)` (planned in
  006-workspaces-and-roles), `src/server/repos` `analyses.get`,
  `analyses.count`, `sources.get`, `sources.rows` (planned in
  007-analyses-and-sources-persistence) and its `PUT /api/analyses/[id]/document`
  handler with the `{ document, revision }` body and the 409 envelope.
- Prototype values, not code: `dist/editor-pro.js` `dashboard()` for the page
  bar, context bar, notes, empty CTA and hint; `dist/studio-engine.js`
  `studioKpis`, `remember`, `undo`/`redo`, the keyboard handler and the
  workspace search; `dist/index.html` for the explorer and footer markup;
  `dist/editor-pro.css` `.pro-canvas`, `.pro-card`, the ≤1300 and ≤760 rules.

Genuinely new: the store, history, autosave, the client root, canvas, cards,
page bar and dialog, context bar, indicator strip, and the chrome islands.

## Files

| File | Change |
|---|---|
| `src/app/(shell)/dashboard/[analysisId]/page.tsx` | created: `requireUser`, `assertCan(actor, "read", analysis)`, loads analysis, source rows and analyses count, computes `readOnly`, renders `<Studio>`; `notFound()` on missing/deleted/foreign |
| `src/app/(shell)/layout.tsx` | modified: wraps children in `StudioProvider`; passes workspace title, analyses count and sources to `Explorer` |
| `src/ui/studio/store.ts` | created: `createStudioStore(initial)`, state and actions, `commit` with schema validation, `useStudio` selector hook |
| `src/ui/studio/history.ts` | created: push/undo/redo over document snapshots, cap 30 |
| `src/ui/studio/keyboard.ts` | created: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z outside text fields |
| `src/ui/studio/store.test.ts` | created: FR-01011 … FR-01018 at store level, NFR-01002, NFR-01003 |
| `src/ui/studio/StudioProvider.tsx` | created: context holding the current store or `null` for non-studio routes |
| `src/ui/studio/Studio.tsx` | created: client root: creates the store, heading, `<área> / <período>`, Período and Área selects, mounts strip, page bar, context bar, notes, canvas, hint; invalid-document and rows-error states |
| `src/ui/studio/studio.module.css` | created: heading, filters, notes, hint, empty CTA |
| `src/ui/studio/Canvas.tsx` | created: 12-column grid, empty CTA, breakpoint rules |
| `src/ui/studio/WidgetCard.tsx` | created: card with `--span`/`--card-height`, selection outline, click/Enter/Space select, renderer by type, chart data from the engine |
| `src/ui/studio/KpiStrip.tsx` | created: four tiles from `metrics` on dashboard filters only |
| `src/ui/studio/canvas.module.css` | created: ported `.pro-canvas`, `.pro-card`, `.studio-kpis`, ≤1300 and ≤760 rules |
| `src/ui/studio/Canvas.test.tsx` | created: FR-01004, FR-01005, FR-01006, FR-01007, FR-01010, FR-01022, FR-01026, FR-01028 |
| `src/ui/studio/PageBar.tsx` | created: tabs, add button, `Configurar página` link |
| `src/ui/studio/PageDialog.tsx` | created: name form (maxlength 60), Duplicar página, Remover (disabled at one page) over `Modal` |
| `src/ui/studio/ContextBar.tsx` | created: `<N> componentes · <M> selecionados` |
| `src/ui/studio/PageBar.test.tsx` | created: FR-01008, FR-01009, FR-01011 … FR-01016 through the DOM |
| `src/ui/studio/autosave.ts` | created: store subscriber, 1 s debounce, `PUT` with revision, 409 → conflict, other → error, unload flush (assumption) |
| `src/ui/studio/HeaderIslands.tsx` | created: `HistoryButtons` (Desfazer/Refazer) and `SaveIndicator` (`Salvo` / `Salvando…` / `Conflito` / failure) reading the store |
| `src/ui/shell/Header.tsx` | modified: mounts `HeaderIslands` in place of the static undo/redo buttons and save indicator; hidden for Leitor and off-studio routes |
| `src/ui/studio/autosave.test.ts` | created: FR-01019, FR-01020, FR-01021, NFR-01004 with fake timers and a fake `fetch` |
| `src/ui/shell/Explorer.tsx` | modified: workspace title, `Análises salvas` count, `Fontes` list, footer link; mounts the islands |
| `src/ui/studio/ExplorerIslands.tsx` | created: `PageTree` (pages + `＋ Nova página`) and `WorkspaceSearch` (`Buscar no workspace`, results, `Nenhuma análise encontrada.`) |
| `src/ui/shell/Footer.tsx` | modified: `Fonte: <source>  |  Moeda: BRL` from props |
| `src/ui/studio/ExplorerIslands.test.tsx` | created: FR-01023, FR-01024, FR-01025 |
| `src/ui/shell/PropertyPanel.tsx` | modified: mounts `PanelHeader`; body stays the 001 placeholder until 011 |
| `src/ui/studio/PanelHeader.tsx` | created: `Propriedades` title and the selected widget's title |
| `tests/e2e/010-studio-canvas.spec.ts` | created: FR-01001, FR-01002, FR-01003, FR-01027, NFR-01001, NFR-01005; conflict flow with two contexts |

## Contracts

- Store state: `{ analysisId, sourceId, document, revision, rows, activePageId,
  selection: string[], history: { past: Document[]; future: Document[] },
  saveState: "saved" | "saving" | "conflict" | "error", readOnly }`.
- Store actions (every one a no-op returning `{ ok: false, reason }` when
  `readOnly`): `setDashboardFilter({ period?, area? })`, `setActivePage(id)`,
  `select(id, { add?: boolean })`, `addPage()`, `renamePage(id, name)`,
  `duplicatePage(id)`, `removePage(id)`, `undo()`, `redo()`, and the generic
  `commit(label, (doc) => Document)` that 011–015 call. `commit` validates the
  result with `documentSchema`; on failure it returns `{ ok: false, field }`
  and changes nothing. Limits (20 pages, 100 widgets) are checked before the
  mutation and reported through the toast text in the assumptions.
- Autosave request (planned in 007): `PUT /api/analyses/{id}/document` with
  `{ document, revision }` → `200 { data: { revision } }`; `409 { error: {
  code: "revision_conflict", message, revision } }`; `400 { error: { code:
  "invalid_document", message, field } }`. This spec introduces no endpoint.
- `StudioProvider` value: `StudioStore | null`; islands render nothing when
  `null`, which is how the header, explorer and panel behave on non-studio
  routes without a second code path.
- Server page props to `<Studio>`: `{ analysis: { id, title, revision, document,
  workspaceId, sourceId }, rows: Row[], sourceName, readOnly }`.
- Nothing breaking: the 001 chrome components keep their signatures and gain
  optional props.

## Order of work

1. Confirm the reused files exist as described (shell chrome and toast/modal
   APIs from 001, `documentSchema` and limits from 002, `chartData`/`metrics`
   from 003, `rendererFor` from 009, `requireUser`, `assertCan`, the analyses
   and sources repositories and the document `PUT` handler from 005–007); if
   not, return blocked. Green: `npm run lint && npm test` on the untouched tree.
2. Store, history, keyboard, with tests: page actions and their limits, undo/redo
   semantics, cap 30, read-only no-ops, `commit` rejecting an invalid result.
   Green: `store.test.ts` passes; no UI yet.
3. Route page, provider, layout wrap, `Studio.tsx` root with heading, filters and
   the invalid-document / rows-error states (filters location: marked
   assumption). Green: a jsdom test renders `Studio` with the demo document and
   finds the heading and both selects; `npm run build` passes with the new route.
4. Canvas, widget cards through `rendererFor`, indicator strip, breakpoints.
   Green: `Canvas.test.tsx` passes, including the scope note and the empty CTA.
5. Page bar, page dialog, context bar. Green: `PageBar.test.tsx` passes: add,
   rename, duplicate, remove, the 20-page and 100-widget refusals.
6. Autosave, header islands, header modification (unload flush: marked
   assumption). Green: `autosave.test.ts` passes with fake timers: one request
   1 s after the last of three rapid changes, 409 → `Conflito` and no further
   request, 500 → failure state then retry on the next change.
7. Explorer islands, explorer and footer modifications, panel header, e2e with
   axe and the two-context conflict flow. Green: `npm run test:e2e` passes;
   traceability shows every id.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The shell layout is a server component and the header/explorer need client state | hydration mismatch or a fully client-rendered shell | only the islands are client components; they read a context whose default is `null`, so the server render of non-studio routes is unchanged |
| Autosave sends while an earlier request is in flight | out-of-order writes, spurious 409 | one in-flight request at a time; a change during flight marks `dirty` and a single follow-up save runs after the response with the returned revision |
| Undo across a save: undo restores an older document but the server holds the newer revision | the next save must still use the latest revision, not the snapshot's | history stores documents only; `revision` lives outside the snapshots and is never restored |
| Whole-document snapshots of a 100-widget document with data-URL images | 31 × up to 1.8 M characters in memory | snapshots are structurally shared where unchanged (widgets map is copied by reference for untouched widgets); NFR-01003 test measures the count, a manual check the memory |
| Chart data for 100 widgets recomputed on every store change | canvas lag over NFR-01002 | `chartData` memoised per widget on `(widget, rows, resolvedFilters)`; only widgets whose inputs changed recompute |
| The page route path contains `[analysisId]` and `(shell)`, invisible to the traceability planned-file regex | "unrequested change" line on every run | known landmine in `_context.md`; explained once in the PR body |
| A Leitor's browser could still call the document endpoint by hand | write by a reader | the server's `assertCan` (planned in 007) refuses with 403 regardless; FR-01027 is about the UI never trying |

## Human approval required

Step 3 adds a server page that calls `requireUser` and `assertCan` exactly as
every other server page does and adds no rule of its own; step 6 wires the
document write that 007 already protects. Both are Q2 (run, then a human
reviews the diff before merge) rather than Q4, for that written reason. No
cryptography, schema migration or deletion in this spec.

## Verification

```
npm ci
docker compose up -d db && npm run db:migrate
npm run lint && npm test && npm run build
npm run dev            # open /dashboard/<demo analysis id> as an Editor and as a Leitor
npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/010-studio-canvas
```

A pass: every command exits 0; in the browser the demo analysis paints its four
indicators, three page tabs and the widgets of `Visão geral`, changing Área
recomputes them, adding a page shows `Página 4` and the dialog, Ctrl/Cmd+Z
removes it with `Alteração desfeita.`, the indicator cycles `Salvando…` →
`Salvo`, a second tab saving first turns the first tab's indicator to
`Conflito`; as a Leitor none of the editing controls exist and the network
panel shows no `PUT`; the matrix shows every FR/NFR with at least one test.

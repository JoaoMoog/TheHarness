# Implementation plan: Filters and interactions

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: the cross-filter is ephemeral view state in the store (never in the
document, cleared on page change); the details dialog caps at 100 rows with the
prototype's sentence; two filter widgets on one dimension and scope write the same
field and the last change wins; a Leitor's filter changes live in a per-session
override layer of the store and are never sent. A different answer changes steps
3, 5 and 7 only.

## Approach

Keep every filter as document state that already exists in the schema
(`dashboard.{area, period, categories}`, `page.filters`, `widget.filters`) and
make the UI write those fields through store actions, so the engine's
`effectiveRows` from 003-query-engine is the only place inheritance is computed.
Interactions are one `applyHit(widgetId, value)` store action that switches on the
widget's interaction and either sets the ephemeral cross-filter, opens the details
dialog or navigates; charts only emit `(widgetId, value)`. The lineage view is a
pure function from `(document, pageId?, widgetId?)` to a list of lines, rendered
by one small component that 016-home-and-planning reuses on `/governanca`.
Rejected: computing effective filters in the UI layer (the prototype did it in
`effectiveRows` inside the editor file) — the export and the assistant need the
same answer on the server, so it must stay in `src/core/engine`. Rejected:
storing the cross-filter in the document — it would autosave on every click and
create an undo entry per exploration step.

## Reuse found

- `src/core/engine/filters.ts` (planned in 003-query-engine): `effectiveFilter`,
  `effectiveRows(document, widget, page, crossFilter?)`, the month-history rule and
  the origin exemption; this plan calls them and adds nothing there.
- `src/core/schema/page.ts`, `widget.ts`, `document.ts` (planned in
  002-domain-schema): `FilterSchema` with `area`, `period`, `categories`, the
  `filter` and `button` widget types, `filterDimension`, `filterScope`,
  `interaction`, `targetPage`.
- `src/ui/studio/store.ts` (planned in 010-studio-canvas): document, active page,
  selection, history; `setActivePage` (which this plan makes clear the cross-filter).
- `src/ui/studio/ContextBar.tsx` (planned in 010-studio-canvas): the buttons
  `Filtros da página`, `ƒ Medidas`, `Versões e modelos` exist unwired; this plan
  wires the first and adds the chip and scope notes beside it.
- `src/ui/studio/KpiStrip.tsx` (planned in 010-studio-canvas): reads dashboard
  filters only; FR-01308 is a test against it, not a change.
- `src/ui/studio/panel/DadosTab.tsx` and `panel/InteracoesTab.tsx` (planned in
  011-widget-editing): `Ação` and `Página de destino` controls exist; this plan
  adds the `Filtros deste componente`, filter-widget and lineage sections to the
  Dados tab.
- `src/ui/charts/*` (planned in 009-svg-charts): renderers accept an `onHit`
  callback and render points as focusable buttons, or this plan adds the
  `hitProps(label, value)` helper there (confirmed in step 1).
- `src/ui/shell/Modal.tsx` and `ToastProvider.tsx` (planned in
  001-app-skeleton): details dialog, page filter dialog and toasts.
- `src/core/format` (planned in 002-domain-schema): `periodLabel` for month labels
  and `money` for the details table.
- Genuinely new: the dashboard filter controls and category dialog, the filter
  field group, the page filter dialog, the filter and button widget renderers, the
  `applyHit` action, the cross-filter chip, the details dialog, the scope notes,
  the lineage function and component, and the e2e file.

## Files

| File | Change |
|---|---|
| `src/ui/studio/store.ts` | modified: `setDashboardFilter(patch)`, `setPageFilter(pageId, field, value \| null)`, `clearPageFilters(pageId)`, `setWidgetFilter(widgetId, field, value \| null)`, `clearWidgetFilters(widgetId)`, ephemeral `crossFilter` state with `applyHit(widgetId, value)` and `clearCrossFilter()`, `setActivePage` clears the cross-filter; reader override layer |
| `src/ui/studio/store.test.ts` | modified: tests for the actions above, one snapshot per call, cross-filter toggle, reader layer never marks dirty |
| `src/ui/studio/filters/DashboardFilters.tsx` | created: `Período` and `Área` selects in the heading and the `Escolha os dados` category dialog with `Selecione ao menos uma categoria.` |
| `src/ui/studio/filters/FilterFields.tsx` | created: the three fields (`Herdar` / `Todas as áreas` / `Todas` / values) bound to a scope; stale stored values kept selectable |
| `src/ui/studio/filters/PageFiltersDialog.tsx` | created: `Filtros · <página>` dialog with help text, `Restaurar herança`, `Concluir` |
| `src/ui/studio/filters/ScopeNotes.tsx` | created: page-filter note, `Centros de custo` note, cross-filter chip with `Limpar ×` |
| `src/ui/studio/filters/FilterWidget.tsx`, `ButtonWidget.tsx` | created: canvas renderers for the two widget types |
| `src/ui/studio/interactions/DetailsDialog.tsx` | created: `Registros · <valor>`, the five-column table, the 100-row cap sentence |
| `src/ui/studio/interactions/hit.ts` | created: `hitProps(widgetId, key, label, formattedValue)` returning role, tabIndex, aria-label and key handlers; Ctrl/Cmd guard |
| `src/core/engine/lineage.ts` | created: `lineage(document, sourceName, pageId?, widgetId?)` → ordered pt-BR lines (pure, reused by 016) |
| `src/core/engine/lineage.test.ts` | created: the line order and wording for every level |
| `src/ui/studio/lineage/Lineage.tsx` | created: renders the lines; used in the Dados tab here and on `/governanca` by 016-home-and-planning |
| `src/ui/studio/filters/*.module.css`, `src/ui/studio/interactions/*.module.css` | created: badge `Filtro próprio`, chip, notes, dialog table |
| `src/ui/studio/filters/*.test.tsx`, `src/ui/studio/interactions/*.test.tsx` | created: unit tests named by requirement id |
| `src/ui/studio/ContextBar.tsx` | modified: wire `Filtros da página` (with ` •`), mount chip and scope notes |
| `src/ui/studio/WidgetCard.tsx` | modified: `Filtro próprio` badge; filter and button renderers by type; pass `onHit` to charts |
| `src/ui/studio/panel/DadosTab.tsx` | modified: `Filtros deste componente` section, `Campo` / `Aplicar a` for filter widgets, collapsed `Rastro da análise` |
| `src/ui/charts/hit.ts` or each renderer under `src/ui/charts/` | modified: data points rendered with `hitProps` (only if 009 did not already expose an `onHit`) |
| `tests/e2e/013-filters-and-interactions.spec.ts` | created: dashboard, page and widget filters, filter widget, cross-filter, details, navigate, button, reader session, axe, timings |

## Contracts

- Store actions (synchronous; each document mutation pushes one history snapshot;
  cross-filter actions push none): `setDashboardFilter({ area?, period?, categories? })`,
  `setPageFilter(pageId, field: "area" | "period" | "categories", value: string | string[] | null)`
  (null removes the field), `clearPageFilters(pageId)`, `setWidgetFilter(widgetId, field, value)`,
  `clearWidgetFilters(widgetId)`, `applyHit(widgetId, value)`, `clearCrossFilter()`.
- Cross-filter shape in the store: `{ origin: string; dimension: "month" | "area" | "category"; value: string } | null`,
  passed to `effectiveRows` for every widget on the active page.
- Reader override: when the actor is a reader, `setDashboardFilter` and the
  filter-widget path write to `viewOverrides` (same shape as the dashboard filter)
  merged over the document for rendering; `dirty` stays false and autosave never
  runs. Editors write the document.
- Hit protocol from charts: `onHit(value: string)` per data point; the point carries
  `role="button"`, `tabIndex={0}`, `aria-label="<rótulo>: <valor formatado>"`.
- `lineage(document, sourceName, pageId?, widgetId?)` returns `string[]` in the
  order stated by FR-01323; the same function feeds `/governanca` in
  016-home-and-planning with only the first argument set.
- Toasts: `Escolha uma página de destino nas propriedades.` and
  `A página de destino não existe mais.` (the second is new; the prototype
  silently ignored a missing page).
- No HTTP contract changes; the document PUT of 010-studio-canvas carries filters.

## Order of work

1. Confirm the reused files exist as described (`effectiveRows` with cross-filter
   and origin exemption, the filter schema, the store, `ContextBar`, `KpiStrip`,
   `DadosTab`, chart `onHit` or the place to add it, `Modal`, `ToastProvider`,
   `periodLabel`); if not, return blocked. Green: existing suites pass.
2. Store actions for dashboard, page and widget filters with snapshots and the
   reader override layer; `DashboardFilters` with the category dialog. Green:
   `store.test.ts` and `DashboardFilters.test.tsx` cover FR-01301..FR-01303,
   FR-01325.
3. `FilterFields`, `PageFiltersDialog`, `ScopeNotes` (page note, centros note),
   `ContextBar` wiring with ` •`, widget `Filtros deste componente` in `DadosTab`,
   `Filtro próprio` badge. Green: tests cover FR-01304..FR-01311, FR-01322, FR-01326.
4. `FilterWidget` and `ButtonWidget` renderers and their Dados controls. Green:
   tests cover FR-01312, FR-01313, FR-01321.
5. `hit.ts`, `applyHit`, cross-filter state and chip, `DetailsDialog`, navigation
   with the two toasts; chart points made focusable. Green: tests cover
   FR-01314..FR-01320.
6. `lineage.ts` (core, pure) and `Lineage.tsx` in the Dados tab. Green:
   `lineage.test.ts` and `Lineage.test.tsx` cover FR-01323, FR-01324, NFR-01304.
7. e2e with a 100-widget, 5 000-row fixture: filter timings, details timing, reader
   session with no PUT observed, axe with chip and dialog open. Green:
   `npm run test:e2e` and the traceability command report every id.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| 009's renderers may not expose a per-point callback, and adding `role="button"` to SVG `<rect>`s needs `tabIndex` and key handlers in every renderer | interactions unreachable by keyboard | step 1 checks; if absent, one `hitProps` helper is spread on the existing point elements in each renderer, a single-line change per file |
| Reader override layer duplicates filter semantics if written as a second code path | readers see different numbers from editors | one selector `visibleDashboardFilter(state)` = document filter merged with overrides, used by every consumer; editors have empty overrides |
| A page filter that stores `Todas as áreas` (`*`) must be distinguishable from "not set" (`Herdar`) | inheritance breaks silently | the schema stores `*` explicitly (prototype value) and `FilterFields` maps `Herdar` to field removal; unit test for each of the three states |
| `setActivePage` in 010's store is also called by page create/duplicate; clearing the cross-filter there must not add history | spurious undo entries | cross-filter lives outside the history-tracked slice; store test asserts history length unchanged |
| The details dialog renders 5 000 rows before slicing | 300 ms budget missed | slice to 100 before rendering; count from the array length |
| Route-group paths are not captured by the traceability planned-file regex | false "unrequested change" lines | known landmine in `_context.md`; no route file is touched here |

## Human approval required

None. Readers are excluded from writes by the store's override layer and by the
server-side `assertCan` on the document PUT owned by 010-studio-canvas; no
authentication, cryptography, migration or deletion is touched.

## Verification

```
npm ci
npm run lint && npm test
npx vitest run src/ui/studio src/core/engine/lineage.test.ts
npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/013-filters-and-interactions
```

Observable: as an Editor, change `Área` in the heading (every chart and the
indicator strip change); open `Filtros da página`, set `Período` to another month
(charts on that page change, the strip does not, the note appears, the button reads
`Filtros da página •`); in a widget's Dados tab set `Categorias` (badge
`Filtro próprio`); insert a filter widget (its select lists the source values);
set a column chart to `Filtrar os outros gráficos` and click a bar (chip
`Filtrando por Categoria: …`, other charts narrow, the bar's chart does not; click
again clears); set `Abrir registros de origem` and click (dialog `Registros · …`
with the five columns); set `Navegar para outra página`, remove the target page
and click (toast `A página de destino não existe mais.`). Sign in as a Leitor: the
heading filters work, no PUT is sent, no `Filtros da página` button. A pass: every
command exits 0 and the matrix shows every FR/NFR with at least one test.

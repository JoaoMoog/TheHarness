# Specification: Filters and interactions

Status: draft
Owner: João Moog

## Problem

After 010-studio-canvas an analysis renders under one fixed dashboard recorte: the
period, area and categories stored in the document. Nobody can narrow a page, give
one widget its own period, drop a filter control onto the canvas for a viewer, click
a bar to filter the neighbouring charts, open the rows behind a number or jump to
another page from a chart or a button. The prototype does all of this with a
three-level inheritance (dashboard → page → widget, "Herdar" restoring the level
above), a cross-filter that exempts its origin, a details modal and a navigation
interaction, and it explains the scoping rules in place with scope notes; the
analysis lineage it shows on the governance page ("Rastro da análise atual") is a
hand-written string that cannot reflect page or widget filters. Without this
specification every dashboard is one static recorte and finance users go back to
spreadsheets to answer the second question. Cross-filter state was never saved by
the prototype; whether it should be is an open question below.

## Goal

An Editor scopes data at dashboard, page and widget level with explicit inheritance,
places filter widgets and interactive widgets on a page, and every viewer can
cross-filter, drill into rows and navigate between pages, with the effective lineage
of any number visible on demand.

## Out of scope

- The engine rules that compute effective rows, inheritance and the cross-filter
  (defined in 003-query-engine); this specification defines the UI that drives them
  and the observable results.
- The property panel frame and the `Interações` tab controls (defined in
  011-widget-editing); this specification wires their behaviour.
- Measures and parameters (defined in 014-measures-and-parameters-ui); the lineage
  view shows a measure name when one is in use and nothing more.
- The governance page that reuses the lineage view (defined in 016-home-and-planning).
- Freezing filters into a shared or exported snapshot (defined in
  017-presentation-and-export).
- Persisting the cross-filter (open question below; not persisted until answered).
- The month-history rule (a month-dimension widget with no own period shows every
  month up to the dashboard period) and the exemption of the indicator strip from
  page and widget filters are engine behaviour defined in 003-query-engine; this
  specification only asserts them where the UI must not hide them.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-01301 | Ubiquitous | The studio heading SHALL render a `Período` select listing every month present in the source rows, newest first, in pt-BR (`setembro de 2026`), an `Área` select listing `Todas as áreas` followed by every area in the source, and the toolbar button `Filtros` SHALL open the dialog `Escolha os dados` with the text `Selecione as categorias que entram em todos os indicadores.`, one checkbox per category, and the buttons `Restaurar todos` and `Aplicar filtros`. |
| FR-01302 | Event | WHEN the dashboard period, area or category set is changed, every widget on every page that does not override that field and the indicator strip SHALL recompute under the new dashboard recorte, committed as one history entry. |
| FR-01303 | Unwanted | IF `Aplicar filtros` is submitted with no category checked, THEN the dialog SHALL stay open, show `Selecione ao menos uma categoria.` and leave the document unchanged. |
| FR-01304 | Event | WHEN an Editor activates `Filtros da página` in the context bar, a dialog titled `Filtros · <nome da página>` SHALL open with an `Área` field offering `Herdar`, `Todas as áreas` and every area, a `Período` field offering `Herdar` and every month, a `Categorias` multi-select offering `Herdar`, `Todas` and every category, the text `Alterações são aplicadas ao selecionar. “Herdar” usa o dashboard.` and the buttons `Restaurar herança` and `Concluir`. |
| FR-01305 | Event | WHEN a page filter field is changed, the page SHALL store that field (`Herdar` removes it; `Todas as áreas` and `Todas` store an explicit no-restriction), the widgets of that page SHALL recompute immediately, and one history entry SHALL be added. |
| FR-01306 | Ubiquitous | A widget's effective filter SHALL be the dashboard filter overridden field by field by the page filter and then by the widget filter, where an explicit `Todas as áreas` or `Todas` at any level removes that field's restriction below the level that set it. |
| FR-01307 | State | WHILE the active page has at least one own filter field, the context bar SHALL label the button `Filtros da página •` and the canvas SHALL show the note `Os filtros desta página substituem os campos correspondentes dos filtros gerais. Os indicadores superiores mostram o recorte geral.`. |
| FR-01308 | State | WHILE page or widget filters are set, the indicator strip above the page tabs SHALL keep showing the dashboard recorte unchanged. |
| FR-01309 | Event | WHEN `Restaurar herança` is activated in the page filter dialog, every page filter field SHALL be removed in one history entry and the note of FR-01307 SHALL disappear. |
| FR-01310 | Ubiquitous | The `Dados` tab of a data-bound widget SHALL render the section `Filtros deste componente` with the text `Substituem os filtros correspondentes da página e do dashboard.`, the same three fields as FR-01304 acting on the widget, and the link `Restaurar herança` that removes every widget filter field in one history entry. |
| FR-01311 | State | WHILE a widget has at least one own filter field, its card SHALL show the badge `Filtro próprio`. |
| FR-01312 | Ubiquitous | A filter widget SHALL render the label of its field (`Mês`, `Área` or `Categoria`), a select whose first option is `Herdar período` for month and `Todos` otherwise, followed by the distinct values of that field in the source rows in ascending order with months labelled in pt-BR, and the caption `Aplica à página atual` or `Aplica à análise inteira` according to its scope. |
| FR-01313 | Event | WHEN a filter widget changes value, the filter field for its dimension at its scope SHALL be set to that value (categories as a one-element list) or, when the first option is chosen, restored to the unrestricted default of that scope (removed for page scope; for dashboard scope area `Todas as áreas`, period the latest month in the source, categories all), in one history entry. |
| FR-01314 | Ubiquitous | Every data point of a chart and every row of a table SHALL be a focusable element with role `button`, accessible name `<rótulo>: <valor formatado>`, activated by click, Enter or Space. |
| FR-01315 | Event | WHEN a data point is activated on a widget whose interaction is `filter`, a cross-filter on the widget's dimension and that value SHALL apply to every other widget of the active page, the origin widget SHALL stay unfiltered, and the chip `Filtrando por <Mês|Área|Categoria>: <valor>` with the button `Limpar ×` SHALL appear above the canvas. |
| FR-01316 | Event | WHEN the same value is activated again on the origin widget, or `Limpar ×` is activated, or the active page changes, the cross-filter SHALL be cleared and the chip removed. |
| FR-01317 | Event | WHEN a data point is activated on a widget whose interaction is `details`, a dialog titled `Registros · <valor>` SHALL open with the text `<n> registros no recorte do componente.` and a table with the columns `Data`, `Área`, `Categoria`, `Realizado`, `Orçamento` holding the widget's effective rows whose dimension equals the value, at most 100 rows, followed by `Mostrando os primeiros 100 registros.` when more exist. |
| FR-01318 | Event | WHEN a data point is activated on a widget whose interaction is `navigate` and its target page exists, the active page SHALL become the target and the cross-filter SHALL be cleared. |
| FR-01319 | Unwanted | IF a navigate interaction or a button widget is activated with no target page set, THEN the active page SHALL stay and the toast `Escolha uma página de destino nas propriedades.` SHALL be shown. |
| FR-01320 | Unwanted | IF a navigate interaction or a button widget is activated and its target page was removed, THEN the active page SHALL stay and the toast `A página de destino não existe mais.` SHALL be shown. |
| FR-01321 | Ubiquitous | A button widget SHALL render one button labelled with its text, or `Abrir página` when the text is empty, whose activation navigates to its target page. |
| FR-01322 | State | WHILE the active page is the `Centros de custo` page of the demo analysis, the canvas SHALL show the note `Centros de custo ilustrativos: esta base contém categorias. Altere a dimensão após conectar uma fonte com centros reais.`. |
| FR-01323 | Ubiquitous | The lineage view `Rastro da análise` SHALL list, in order: `Fonte: <nome da fonte>`; `Medida de custo: soma de “realizado”. Saldo: orçamento − realizado.`; `Filtros: <área>, <período>. Categorias: <lista ou todas>.`; when a page is in context `Filtros da página: <campos ou herdados>`; when a widget is in context `Filtros do componente: <campos ou herdados>` and, when it uses a measure, `Medida: <nome> = <expressão>`; and last `Projeção: média dos últimos 3 meses disponíveis até a data-base. Não é modelo preditivo.`. |
| FR-01324 | Event | WHEN a widget is selected, the `Dados` tab SHALL show a collapsed section `Rastro da análise` rendering the lineage view for that widget's effective filter. |
| FR-01325 | State | WHILE the current user is a Leitor, the dashboard filters, filter widgets, cross-filter, details dialog and navigation SHALL be operable without any document write being sent. |
| FR-01326 | State | WHILE the current user is a Leitor, the `Filtros da página` button, the page filter dialog and the `Filtros deste componente` section SHALL be absent. |
| NFR-01301 | Ubiquitous | Changing any filter on an analysis of 100 widgets over 5 000 rows SHALL repaint the active page within 200 ms on the e2e runner. |
| NFR-01302 | Ubiquitous | The details dialog SHALL open within 300 ms of activation for a widget whose effective rows number 5 000. |
| NFR-01303 | Ubiquitous | Every data point, filter control, chip button and dialog control SHALL be reachable by Tab and operable by keyboard alone; an automated accessibility scan of the canvas with an open cross-filter and an open details dialog SHALL report zero violations of impact `serious` or `critical`. |
| NFR-01304 | Ubiquitous | A filter widget SHALL list at most 200 options; a source with more distinct values SHALL show the first 200 in order and the caption `Mostrando 200 de <total> valores`. |

## Open questions

`[NEEDS CLARIFICATION: is the cross-filter ephemeral view state (prototype: cleared on page change and never saved) or part of the document so it survives reload and reaches a shared view? Saving it adds a document field, a schema change in 002-domain-schema and an undo entry per click.]`

`[NEEDS CLARIFICATION: the details dialog row cap — the prototype shows the first 100 of an unbounded selection; a higher cap or paging changes the dialog and the wording "Mostrando os primeiros 100 registros.".]`

`[NEEDS CLARIFICATION: two filter widgets on the same dimension and scope write the same field, so the last change wins and both reflect it (prototype); if one must take precedence or the second must be refused, the insert rules in 011-widget-editing change.]`

`[NEEDS CLARIFICATION: do a Leitor's dashboard-filter and filter-widget changes stay local to the session (assumed) or persist for everyone? Persisting them means a Leitor writes the document, which the authorisation matrix forbids today.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/013-filters-and-interactions
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

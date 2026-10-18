# Specification: Studio canvas

Status: draft
Owner: João Moog

## Problem

After 007-analyses-and-sources-persistence an analysis can be created and its
document written back, but opening it shows nothing: the `/dashboard` route is
still the placeholder from 001-app-skeleton. The prototype keeps the open
analysis in a global object, saves it to the browser's local storage on every
change and rebuilds the whole page from string templates, so two people editing
the same analysis silently overwrite each other and closing the tab is the only
"conflict" anyone sees. The rewrite departs from that on purpose: the document
lives on the server with a `revision`, the browser autosaves against that
revision and a stale write is refused, and undo/redo stays in memory for the
session (never persisted, never synced across tabs). Without this canvas none
of the editing, filtering, presentation or assistant specifications has a
surface to land on, and Leitor members cannot read what Editores built.

## Goal

Opening an analysis renders its pages and widgets on the 12-column canvas
inside the studio shell, with page tabs, selection, the indicator strip,
client-side undo/redo and debounced server autosave that detects conflicts,
while a Leitor gets the same canvas without a single editing control.

## Out of scope

- Editing any widget property, inserting, duplicating or deleting widgets, and
  the property panel's contents — 011-widget-editing. The panel renders its
  chrome and the selected widget's title only.
- Drag reordering, pointer or keyboard resize and the Organizar menu —
  012-layout-drag-resize.
- Page-level and widget-level filter editing, filter widgets, cross-filtering
  and click interactions — 013-filters-and-interactions. Stored page and widget
  filters are still honoured when computing chart data.
- Measures and parameters — 014-measures-and-parameters-ui; versions and
  templates — 015-versions-and-templates; presentation, export and sharing —
  017-presentation-and-export; the assistant — 019-assistant-ui.
- The toolbar buttons Inserir, Gráfico, Texto, Filtros, Organizar, Apresentar,
  Exportar and Compartilhar are present and do nothing until their specs.
- Real-time collaboration or merging of concurrent edits: a conflict is
  reported, never resolved automatically.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-01001 | Event | WHEN a member of the analysis's workspace opens `/dashboard/<analysisId>`, the studio SHALL render, inside the shell, the analysis title, the line `<área> / <período>`, the Período and Área selects, the indicator strip, the page bar, the context bar and every widget of the active page, in the order stored in the document. |
| FR-01002 | Unwanted | IF the analysis id does not exist, is soft-deleted, or belongs to a workspace the visitor is not a member of, THEN the route SHALL respond with the shell's 404 page and no distinction between the three cases. |
| FR-01003 | Unwanted | IF the stored document fails validation as defined in 002-domain-schema, THEN the studio SHALL show a pt-BR error inside the main area, render no widget and attempt no save. |
| FR-01004 | Ubiquitous | The canvas SHALL lay widgets on a 12-column grid with a 14 px gap where each card occupies `span` columns and `height` px, rendering its content through the renderer for its type as defined in 009-svg-charts with chart data computed as defined in 003-query-engine from the analysis's source rows. |
| FR-01005 | Event | WHEN the Período or Área select changes, the studio SHALL recompute every widget of the active page and the indicator strip with the new dashboard-level filter and update the `<área> / <período>` line, without a page reload. |
| FR-01006 | Ubiquitous | The indicator strip SHALL show four tiles computed from the dashboard-level filters only: `Custo realizado`, `Orçamento`, the absolute difference labelled `Saldo disponível` when budget ≥ actual or `Acima do orçamento` otherwise, and the percentage to one decimal with `↘` and `abaixo do orçamento` or `↗` and `acima do orçamento`, the last two tiles styled as good or bad accordingly. |
| FR-01007 | State | WHILE the active page has its own filters, the studio SHALL show the note `Os filtros desta página substituem os campos correspondentes dos filtros gerais. Os indicadores superiores mostram o recorte geral.` between the context bar and the canvas. |
| FR-01008 | Ubiquitous | The page bar SHALL show one tab per page in document order with the active tab highlighted, an add button with the accessible name `Adicionar página`, and a `Configurar página` link; the context bar SHALL read `<N> componentes` and append ` · <M> selecionados` while more than one widget is selected. |
| FR-01009 | Event | WHEN a page tab, or the page's entry in the explorer tree, is activated, the studio SHALL make that page active, select its first widget (or nothing when it is empty), render its widgets and mark the entry in the tree. |
| FR-01010 | State | WHILE the active page has no widgets, the canvas SHALL show the call to action `＋ Adicionar o primeiro componente`; every page SHALL end with the hint `Arraste pelo ícone ⠿ · ajuste pelo canto inferior · Ctrl/Cmd + clique para selecionar vários.` |
| FR-01011 | Event | WHEN an Editor adds a page, the studio SHALL append a page named `Página <N>` where N is the new page count, make it active, and open the `Configurar página` dialog with the name field focused. |
| FR-01012 | Unwanted | IF the document already has 20 pages, THEN adding or duplicating a page SHALL be refused with a toast that names the limit of 20 and the document SHALL be unchanged. |
| FR-01013 | Event | WHEN the `Configurar página` form is submitted, the studio SHALL rename the active page to the trimmed name of at most 60 characters, or `Página` when the name is empty. |
| FR-01014 | Event | WHEN `Duplicar página` is chosen, the studio SHALL append a page named `<name> · cópia` holding a copy of every widget with new ids and a copy of the page filters, and make it active. |
| FR-01015 | Unwanted | IF duplicating a page would bring the document above 100 widgets, THEN the duplication SHALL be refused with a toast that names the limit of 100 and the document SHALL be unchanged. |
| FR-01016 | Complex | WHEN `Remover` is chosen in the page dialog, IF the document has more than one page, THEN the studio SHALL delete the page and its widgets, activate the first remaining page and show the toast `Página removida. Use Desfazer para recuperar.` (the button is disabled while only one page exists). |
| FR-01017 | Event | WHEN the document changes through any studio action, the studio SHALL push the previous document onto the undo history, keep at most the 30 most recent entries, and clear the redo history. |
| FR-01018 | Event | WHEN Desfazer or Refazer is activated (its header button, or Ctrl/Cmd + Z and Ctrl/Cmd + Shift + Z outside a text field), the studio SHALL move one snapshot between the undo and redo histories in that direction, restore it as the document and show the toast `Alteração desfeita.` or `Alteração refeita.` (each button is disabled while its history is empty). |
| FR-01019 | Event | WHEN the document changes, the save indicator SHALL show `Salvando…` and, 1 second after the last change, the studio SHALL send the whole document with the revision it was loaded or last saved with; on success the indicator SHALL show `Salvo` and the studio SHALL adopt the returned revision. |
| FR-01020 | Unwanted | IF the save is refused because the revision is stale, THEN the indicator SHALL show `Conflito`, a toast SHALL offer to reload the analysis, and no further save SHALL be attempted until the analysis is reloaded. |
| FR-01021 | Unwanted | IF the save fails for any other reason, THEN the indicator SHALL show a pt-BR failure state, the document SHALL stay in memory unchanged, and the next document change SHALL retry the save. |
| FR-01022 | Event | WHEN a widget card is clicked, or Enter or Space is pressed on a focused card, the studio SHALL select that widget, outline it, and show its title in the property panel header. |
| FR-01023 | Ubiquitous | The explorer sidebar SHALL show the workspace title, a search field labelled `Buscar no workspace`, the analysis title as the tree root with one entry per page and a `＋ Nova página` entry, an `Análises salvas` link with the count of analyses in the workspace, the `Fontes` list with the analysis's source, and the footer link `Acesso e governança`. |
| FR-01024 | Event | WHEN text is typed in the workspace search, the explorer SHALL replace the tree with the analyses of the workspace whose title contains the text ignoring case, each opening its analysis, or the text `Nenhuma análise encontrada.` when none matches; clearing the field SHALL restore the tree. |
| FR-01025 | Ubiquitous | The footer SHALL read `Fonte: <source name>  |  Moeda: BRL`. |
| FR-01026 | State | WHILE the viewport is 1300 px wide or narrower, every card SHALL span all 12 columns; WHILE it is 760 px or narrower, the grid gap SHALL be 12 px and every card SHALL be at least 240 px tall. |
| FR-01027 | State | WHILE the signed-in member is a Leitor, the studio SHALL render the canvas, tabs, filters and explorer without the add-page button, the `Configurar página` link, the `＋ Nova página` entry, the empty-page call to action, the hint, the undo and redo buttons and the save indicator, and SHALL send no write request whatever the member does. |
| FR-01028 | Unwanted | IF the source rows cannot be loaded, THEN the studio SHALL render the shell with a pt-BR error in place of the canvas and disable the filter selects. |
| NFR-01001 | Ubiquitous | A document with 100 widgets on the active page SHALL be fully painted within 1 s of navigation on a local build, measured from the route request to the last card being in the DOM. |
| NFR-01002 | Ubiquitous | A store mutation SHALL be reflected on the canvas within 100 ms, measured in the unit-test environment from the action call to the DOM update. |
| NFR-01003 | Ubiquitous | The undo history SHALL hold at most 30 snapshots and release older ones, so memory never exceeds 31 copies of the document. |
| NFR-01004 | Ubiquitous | The autosave request body SHALL be the validated document only and SHALL never exceed the document size cap defined in 002-domain-schema; a document above the cap is not sent and the indicator shows the failure state. |
| NFR-01005 | Ubiquitous | An automated accessibility scan of `/dashboard/<analysisId>` with the demo analysis SHALL report zero violations of impact `serious` or `critical`. |

## Open questions

`[NEEDS CLARIFICATION: unsaved changes on navigation or unload — with a 1 s debounce a change can be pending when the user leaves; block navigation with a prompt, flush the save synchronously, or accept the loss? It decides whether the store registers a beforeunload handler and a route guard.]`

`[NEEDS CLARIFICATION: explorer search scope — the prototype matches analysis titles only; should it also match page names and widget titles inside the open analysis? It changes FR-01024 and the result list markup.]`

`[NEEDS CLARIFICATION: offline behaviour — when the save fails because the network is down, retry with backoff automatically or wait for the next change as FR-01021 says? Automatic retry needs a timer and an "offline" indicator state.]`

`[NEEDS CLARIFICATION: the toast text for the 20-page and 100-widget refusals — the prototype has no string because it never refused; propose `Limite de 20 páginas por análise.` and `Limite de 100 componentes por análise.` unless copy says otherwise.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/010-studio-canvas
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

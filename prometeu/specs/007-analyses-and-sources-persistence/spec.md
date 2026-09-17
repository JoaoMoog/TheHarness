# Specification: Analyses and sources persistence

Status: draft
Owner: João Moog

## Problem

The prototype keeps every dashboard and every imported source in the visitor's
localStorage under one key, warns "O armazenamento local está cheio" when the browser
runs out, and loses everything on another device. Its library page ("Meus dashboards")
lists "Análises salvas neste navegador". With sign-in (005-authentication) and
workspaces (006-workspaces-and-roles) in place, analyses and sources must be stored on
the server, owned by a workspace, and written with a concurrency check so that two
tabs or two people cannot silently overwrite each other. This spec changes three
prototype behaviours: localStorage becomes server storage with an integer revision and
a refused stale write; the coercing sanitizer that clamped bad documents becomes a
rejection with the field path at the boundary, using the document rules defined in
002-domain-schema; and the hash route `#dashboard` becomes `/dashboard/<id>`, with `/`
and `/dashboard` resolving to the most recently updated analysis.

## Goal

Every workspace holds its sources and analyses on the server; a member can list,
search, open, create, rename, duplicate and delete analyses from `/dashboards`; a
document write carries a revision and is refused when stale; and a new workspace
starts with the demonstration source so the first analysis can be created at once.

## Out of scope

- File upload, parsing and the `/dados` page (008-file-import-and-data-page); this
  spec stores sources and rows and seeds the demonstration source only.
- Named versions and templates (015-versions-and-templates), scenarios
  (016-home-and-planning), sharing and export (017-presentation-and-export).
- The studio canvas and the autosave client (010-studio-canvas): `/dashboard/<id>`
  here renders a read-only summary of the stored analysis so the walking skeleton can
  be verified end to end.
- The assistant's conversation history (`messages[]` in the prototype's dashboard
  object) — see the open questions.
- Hard deletion, retention and purge of soft-deleted analyses.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-00701 | Ubiquitous | Every source SHALL belong to exactly one workspace and carry a name of 1 to 120 characters, a kind, its row count and its creation time, and its rows SHALL each hold date, area, category, realizado and orçado as defined in 002-domain-schema. |
| FR-00702 | Event | WHEN a workspace is created, the application SHALL seed it with one source of the demonstration kind named `SAP S/4HANA · demonstração` holding exactly the 90 rows of the deterministic demonstration dataset defined in 002-domain-schema. |
| FR-00703 | Event | WHEN a member requests the rows of a source, the application SHALL return every row of that source in one bounded collection ordered by date, area and category, with the collection's `nextCursor` empty. |
| FR-00704 | Event | WHEN a member lists the sources of the current workspace, the application SHALL return each source's name, kind, row count and creation time, ordered by creation time, demonstration first. |
| FR-00705 | Event | WHEN an Editor creates an analysis from a source, the application SHALL store a new analysis with revision 1, the period equal to the latest month present in the source's rows, the area equal to the area of the source's first row, the title `Visão de custos · <area>` for the demonstration source or `Análise · <source name>` for any other source, and the default document. |
| FR-00706 | Ubiquitous | The default document SHALL contain three pages named `Visão geral`, `Centros de custo` and `Detalhamento`, the first holding the widgets titled `Evolução dos custos`, `Custos por categoria` and `Detalhamento dos custos`, the second `Custos por centro de custo` and the third `Detalhamento financeiro`, each widget valid under 002-domain-schema. |
| FR-00707 | Unwanted | IF the source has zero rows or does not belong to the current workspace, THEN the creation SHALL be refused with HTTP 404 and no analysis stored. |
| FR-00708 | Event | WHEN a member opens an analysis, the application SHALL return its title, source name, period, area, revision, update time and the full document. |
| FR-00709 | Complex | WHEN an Editor replaces the document of an analysis sending the revision they last read, IF it equals the stored revision, THEN the application SHALL store the document, increment the revision by one, update the update time and return the new revision. |
| FR-00710 | Unwanted | IF the sent revision differs from the stored revision, THEN the application SHALL refuse with HTTP 409, code `revision_conflict`, the message `Esta análise foi alterada em outro lugar. Recarregue para continuar.` and the current revision, storing nothing. |
| FR-00711 | Unwanted | IF the sent document violates any rule of 002-domain-schema, THEN the application SHALL refuse with HTTP 400 naming the first offending field path, storing nothing. |
| FR-00712 | Event | WHEN an Editor renames an analysis with a title of 1 to 100 characters after trimming, the application SHALL store the new title without changing the revision of the document. |
| FR-00713 | Unwanted | IF the new title is empty or longer than 100 characters after trimming, THEN the application SHALL refuse with HTTP 400 naming the `title` field and the message `Informe um nome de 1 a 100 caracteres.`. |
| FR-00714 | Event | WHEN an Editor duplicates an analysis, the application SHALL create a new analysis in the same workspace with the same source, period, area and an identical copy of the document, revision 1, and the title of the original followed by ` · cópia`, and show the toast `Cópia criada.`. |
| FR-00715 | Event | WHEN an Editor confirms the deletion of an analysis, the application SHALL mark it deleted so that it disappears from every list and opening it answers HTTP 404, keeping its data for recovery. |
| FR-00716 | Ubiquitous | The delete action on a library card SHALL open a confirmation dialog titled `Excluir dashboard?` with the text `A análise será removida do workspace.` and the actions `Cancelar` and `Excluir dashboard`, and SHALL delete nothing until `Excluir dashboard` is activated. |
| FR-00717 | Unwanted | IF a Leitor attempts to create, replace, rename, duplicate or delete an analysis, THEN the application SHALL refuse with HTTP 403 as defined in 006-workspaces-and-roles and change nothing. |
| FR-00718 | Unwanted | IF an analysis id does not exist, is deleted, or belongs to a workspace the person is not a member of, THEN the application SHALL answer HTTP 404 for the JSON request and, for `/dashboard/<id>`, the pt-BR not-found page inside the shell. |
| FR-00719 | Event | WHEN a member lists the analyses of the current workspace, the application SHALL return them ordered by update time descending, at most 100 per page with a cursor, each with title, source name, source kind, period, area, row count of its source and update time. |
| FR-00720 | Event | WHEN the library search field receives text, the application SHALL show only the analyses whose title contains the text, comparing without regard to case or accents, and show `Nenhum dashboard encontrado` with `Tente buscar por outro nome.` when none matches. |
| FR-00721 | Ubiquitous | `/dashboards` SHALL render the eyebrow `SUAS DESCOBERTAS, ORGANIZADAS`, the heading `Meus dashboards`, the action `Nova análise`, a search field with the accessible name `Buscar dashboards` and the placeholder `Buscar pelo nome do dashboard...`, and one card per analysis showing the tag `Exemplo SAP` for the demonstration source or `Dados importados` otherwise, the title, the period label and area, the row count as `<n> registros`, the update time, and the actions `Duplicar` and a delete button with the accessible name `Excluir <title>`. |
| FR-00722 | Event | WHEN a member activates a library card, the application SHALL navigate to `/dashboard/<id>` of that analysis. |
| FR-00723 | Event | WHEN a member activates `Nova análise`, the application SHALL open a dialog titled `Fonte e data-base` listing the workspace's sources under `Fonte de dados` with the action `Usar esta fonte`, and on confirmation create the analysis and navigate to it. |
| FR-00724 | Event | WHEN a signed-in member requests `/` or `/dashboard` without an id, the application SHALL redirect to `/dashboard/<id>` of the most recently updated analysis of the current workspace. |
| FR-00725 | Unwanted | IF the current workspace has no analysis, THEN `/` and `/dashboard` SHALL render an empty state with the heading `Nenhuma análise ainda` and the action `Nova análise` instead of redirecting. |
| FR-00726 | Ubiquitous | `/dashboard/<id>` SHALL render the analysis title as the page heading, the source name, the period label and the names of its pages, until the studio canvas replaces it (010-studio-canvas). |
| NFR-00701 | Ubiquitous | Replacing a document of maximum size allowed by 002-domain-schema SHALL complete within 300 ms at p95 on the local server, including validation. |
| NFR-00702 | Ubiquitous | Listing the first page of analyses in a workspace holding 1,000 analyses SHALL complete within 200 ms at p95 on the local server. |
| NFR-00703 | Ubiquitous | Returning the rows of a source holding 5,000 rows SHALL complete within 400 ms at p95 on the local server with a response body under 1 MB. |
| NFR-00704 | Ubiquitous | Library search over 1,000 titles SHALL update the visible cards within 200 ms of the last keystroke. |
| NFR-00705 | Ubiquitous | An automated accessibility scan of `/dashboards`, its dialogs and the empty state SHALL report zero violations of impact `serious` or `critical`. |

## Open questions

`[NEEDS CLARIFICATION: is the assistant conversation (the prototype's `messages[]` on each dashboard) persisted with the analysis, or dropped until 019-assistant-ui defines its own storage? It decides whether the document or the analysis carries a messages field.]`

`[NEEDS CLARIFICATION: retention of soft-deleted analyses — kept forever, purged after N days, or restorable from a screen? It decides whether a purge job and a restore action exist.]`

`[NEEDS CLARIFICATION: may an Editor delete or rename an analysis created by someone else, or only their own? An ownership rule adds a creator check to two actions.]`

`[NEEDS CLARIFICATION: must titles be unique within a workspace? Duplication appends ` · cópia` and would need a counter if so.]`

`[NEEDS CLARIFICATION: cap on analyses per workspace — the prototype had none beyond browser storage; a cap needs a number and a pt-BR message.]`

`[NEEDS CLARIFICATION: the prototype renders the four top indicators and the waterfall outside its widget model; must the default document include them as indicator and waterfall widgets, or does the canvas render them from the analysis as the prototype did? It changes the default document.]`

`[NEEDS CLARIFICATION: the prototype hides the delete action while only one dashboard exists; with a server-side empty state, is that rule kept or dropped?]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/007-analyses-and-sources-persistence
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

# Specification: Domain schema

Status: draft
Owner: João Moog

## Problem

The prototype has no written definition of its data. The shape of a widget, a page,
a measure or a parameter exists only inside `cleanPro`, a sanitizer that silently
clamps out-of-range numbers, drops unknown keys and replaces bad values with
defaults, so a client that sends `span: 40` gets a document with `span: 12` and
never learns it was wrong. Limits are duplicated across three files (`pickDashboard`,
`sanitizeStudio`, `cleanPro`), number formatting exists in five variants (`money`,
`compact`, `currency`, `axisNumber`, `numberPro`) with different rules, and the
demo dataset is a module-level side effect built with a loop nobody can reproduce
from a description. Every later feature (persistence, import, charts, editing, the
assistant's patches) validates against these shapes; if each defines its own, the
server and the browser drift apart on the first change.

This specification changes one behaviour on purpose: the rewrite **rejects**
invalid input at every boundary with the path of the offending field, instead of
coercing it. User-interface controls keep values in range before sending; anything
that arrives out of range is an error, not a correction. A second, smaller change:
the prototype stored the selected widget inside the document (`selected`); the
rewrite keeps selection as session state outside the document.

## Goal

One validated, typed definition of every domain object with the prototype's limits,
enumerations and defaults, plus pt-BR number formatting and the deterministic demo
dataset, that produces identical results on the server and in the browser.

## Out of scope

- Any computation over rows (selection, grouping, metrics, chart data): defined in
  003-query-engine.
- The formula language of measures beyond the length of the expression string:
  004-formula-interpreter.
- Storing, loading or migrating documents; concurrency; ownership: defined in
  007-analyses-and-sources-persistence.
- Parsing files into rows: 008-file-import-and-data-page. This specification
  defines what a valid row is, not how a file becomes rows.
- Any user interface, including the controls that clamp before sending.
- The legacy prototype fields `trendType`, `mixType`, `trendTitle`, `mixTitle`,
  `tableTitle`, `showBudget`, `studio` and `messages` on an analysis; they belong
  to the pre-editor prototype and are not carried over.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-00201 | Ubiquitous | The domain SHALL define a Row as `date` (a string `AAAA-MM-DD` naming a real calendar date), `area` and `category` (strings of 1 to 100 characters after trimming), `actual` and `budget` (finite numbers greater than or equal to 0), and SHALL accept a row only when all five hold. |
| FR-00202 | Ubiquitous | The domain SHALL define a Widget with exactly the keys `id`, `type`, `title`, `subtitle`, `text`, `image`, `imageFit`, `dimension`, `value`, `comparison`, `legendField`, `aggregation`, `sort`, `top`, `span`, `height`, `color`, `comparisonColor`, `background`, `textColor`, `borderColor`, `font`, `fontSize`, `titleSize`, `padding`, `radius`, `border`, `legend`, `labels`, `axes`, `grid`, `unit`, `decimals`, `format`, `target`, `condition`, `conditionColor`, `interaction`, `targetPage`, `filters`, `filterScope`, `filterDimension` and `columns`, every key required, and SHALL reject a widget with a missing or unknown key naming that key. |
| FR-00203 | Ubiquitous | A Widget SHALL accept only these enumerated values: `type` in `column`, `bar`, `line`, `area`, `donut`, `table`, `waterfall`, `kpi`, `text`, `image`, `button`, `filter`; `dimension` in `month`, `area`, `category`; `legendField` in `none` plus the three dimensions; `aggregation` in `sum`, `avg`, `count`, `min`, `max`; `sort` in `label`, `desc`, `asc`; `unit` in `auto`, `mil`, `mi`; `format` in `number`, `currency`, `percent`; `font` in `Segoe UI`, `Arial`, `Georgia`; `condition` in `none`, `budget`, `target`; `interaction` in `none`, `filter`, `details`, `navigate`; `filterScope` in `page`, `dashboard`; `filterDimension` in `category`, `area`, `month`; `imageFit` in `contain`, `cover`; `value` and `comparison` matching `^(actual|budget|count|none|m[a-z0-9]+)$`. |
| FR-00204 | Ubiquitous | A Widget SHALL accept only integers inside these closed ranges: `span` 3 to 12, `height` 180 to 800, `fontSize` 10 to 22, `titleSize` 12 to 30, `padding` 0 to 36, `radius` 0 to 24, `border` 0 to 4, `decimals` 0 to 4, `top` 0 to 50; `target` SHALL be a finite number between −1 000 000 000 000 and 1 000 000 000 000 inclusive. |
| FR-00205 | Ubiquitous | A Widget SHALL accept `title` of 1 to 150 characters, `subtitle` of 0 to 200, `text` of 0 to 4 000, the six colour keys (`color`, `comparisonColor`, `background`, `textColor`, `borderColor`, `conditionColor`) only as `#` followed by exactly six hexadecimal digits in either case, `legend`, `labels`, `axes`, `grid` only as booleans, `targetPage` as an empty string or a valid identifier, and `columns` as a non-empty list of distinct entries drawn from `label`, `value`, `comparison`, `delta`. |
| FR-00206 | Ubiquitous | Every identifier of a widget, page or `targetPage` SHALL match `^[a-zA-Z0-9_-]{1,70}$` and SHALL NOT be `__proto__`, `constructor` or `prototype`; a measure identifier SHALL match `^m[a-z0-9]+$`. |
| FR-00207 | Unwanted | IF a widget `image` is not the empty string and is not a data URL matching `^data:image/(png|jpeg|webp);base64,[a-z0-9+/=]+$` (case-insensitive) of fewer than 1 800 000 characters, THEN the domain SHALL reject the widget naming the field `image` and the failed rule (type or size). |
| FR-00208 | Ubiquitous | The domain SHALL define a Filter as an object with the optional keys `area` (string of 1 to 150 characters, where `*` and `Todas as áreas` mean every area), `period` (a string `AAAA-MM` with month 01 to 12) and `categories` (a list of 0 to 100 strings of 1 to 150 characters), where an absent key means "inherit from the level above" and an empty `categories` list means "every category". |
| FR-00209 | Ubiquitous | The domain SHALL define a Page as `id` (identifier), `name` (1 to 60 characters), `widgets` (a list of distinct widget identifiers) and `filters` (a Filter), and a Measure as `id`, `name` (1 to 70 characters), `expression` (1 to 300 characters) and `format` in `number`, `currency`, `percent`. |
| FR-00210 | Ubiquitous | The domain SHALL define Params as a map of at most 20 entries whose keys match `^[a-z][a-z0-9_]{0,30}$`, are none of `constructor`, `prototype`, `__proto__`, `realizado`, `orcado`, `registros`, and whose values are finite numbers. |
| FR-00211 | Ubiquitous | The domain SHALL define a Document as `schemaVersion` (the integer 1), `widgets` (a map of identifier to Widget with 0 to 100 entries whose map key equals the widget's `id`), `pages` (1 to 20 pages with distinct ids), `activePage`, `measures` (0 to 30, distinct ids) and `params`, and SHALL define the default new Document as one page `overview` named `Visão geral` with no widgets, `activePage: "overview"`, no measures and `params: { colaboradores: 100 }`. |
| FR-00212 | Unwanted | IF a Document's `activePage` names no page, or a page lists a widget id absent from `widgets`, or a widget id appears on no page or on more than one page, THEN the domain SHALL reject the document naming the path of the first offending entry (for example `pages.1.widgets.3` or `activePage`). |
| FR-00213 | Unwanted | IF any value at any boundary is outside its range, longer than its limit, not in its enumeration, of the wrong type, or exceeds a count limit (101 widgets, 21 pages, 31 measures, 21 params, 101 categories), THEN the domain SHALL reject the whole input with a pt-BR message and the dotted path of the first offending field, and SHALL NOT return a corrected copy. |
| FR-00214 | Event | WHEN a new widget of a given type is requested, the domain SHALL return a widget with these defaults: `type: column`, `dimension: month`, `value: actual`, `comparison: budget`, `legendField: none`, `aggregation: sum`, `sort: label`, `top: 0`, `span: 6`, `height: 330`, `color: #123993`, `comparisonColor: #4c7dff`, `background: #ffffff`, `textColor: #172747`, `borderColor: #dfe7f4`, `font: Segoe UI`, `fontSize: 12`, `titleSize: 15`, `padding: 14`, `radius: 4`, `border: 1`, `legend`, `labels`, `axes`, `grid` all true, `unit: auto`, `decimals: 0`, `format: number`, `subtitle`, `text`, `image`, `targetPage` empty, `imageFit: contain`, `target: 0`, `condition: none`, `conditionColor: #d44655`, `interaction: details`, `filters: {}`, `filterScope: page`, `filterDimension: category`, `columns: [label, value, comparison, delta]`, then overridden per type as in the next requirement. |
| FR-00215 | Event | WHEN a new widget is created, the domain SHALL set `title` to the type's pt-BR label (`Colunas agrupadas`, `Barras horizontais`, `Linhas`, `Área`, `Rosca`, `Tabela`, `Cascata`, `Indicador`, `Texto`, `Imagem`, `Botão`, `Filtro`), `dimension` to `category` for `bar`, `donut`, `table`, `waterfall` and `kpi` and to `month` otherwise, and for the types `text`, `image`, `button`, `filter` and `kpi` SHALL set `height` to 280 for `image` and 200 for the other four, and `span` to 3 for `kpi` and `filter` and 6 for the other three. |
| FR-00216 | Ubiquitous | The domain SHALL define Analysis metadata as `id`, `title` (1 to 150 characters), `sourceId`, `period` (`AAAA-MM`), `area` (1 to 150 characters, `Todas as áreas` allowed), `categories` (0 to 100 strings), `document` (a Document), `revision` (integer ≥ 1) and `updatedAt` (an ISO 8601 timestamp), a Version as `id`, `analysisId`, `name` (1 to 80 characters), `createdAt` and `snapshot` (`document`, `title`, `period`, `area`, `categories`), a Template as `id`, `name` (1 to 80 characters) and `document`, and a Scenario as `name`, `area`, `period`, `assumptions` (`infra`, `people`, `services`, each an integer from −30 to 30), `base`, `budget`, `value` and `delta` (finite numbers). |
| FR-00217 | Ubiquitous | The domain SHALL format a number for a widget as: value divided by 1 000 with the suffix ` mil` when `unit` is `mil`, by 1 000 000 with ` mi` when `mi`, unchanged when `auto`; rendered in pt-BR with exactly `decimals` fraction digits; prefixed with `R$ ` when `format` is `currency` and suffixed with `%` when `percent`; so that 1 284 000 gives `1.284.000` (auto, 0, number), `R$ 1.284,0 mil` (mil, 1, currency), `R$ 1,28 mi` (mi, 2, currency), and 1.2307 gives `1,2%` (auto, 1, percent). |
| FR-00218 | Unwanted | IF the number to format is `null`, `NaN`, `+Infinity` or `−Infinity`, THEN every formatting function SHALL return the string `—` (em dash) and SHALL NOT throw. |
| FR-00219 | Ubiquitous | The domain SHALL provide currency formatting as Brazilian real with zero fraction digits (1 284 000 → `R$ 1.284.000`, −15 000 → `-R$ 15.000`, 0 → `R$ 0`), compact formatting as the currency form when the absolute value is below 10 000, `R$ ` + two-decimal millions + ` mi` at or above 1 000 000 (1 284 000 → `R$ 1,28 mi`) and `R$ ` + integer thousands + ` mil` otherwise (84 000 → `R$ 84 mil`, 9 999 → `R$ 9.999`), and axis formatting relative to a scale maximum: one-decimal millions + ` mi` when the maximum is at least 1 000 000 (1 284 000 → `1,3 mi`), integer thousands + ` mil` when at least 10 000 (84 000 → `84 mil`), integer otherwise (9 999 → `9.999`). |
| FR-00220 | Ubiquitous | The domain SHALL label a period `AAAA-MM` as the capitalised pt-BR month name, ` de ` and the year (`2026-09` → `Setembro de 2026`, `2027-01` → `Janeiro de 2027`) and as the short form `set. de 26` where a chart axis asks for it. |
| FR-00221 | Ubiquitous | The domain SHALL generate the demo dataset as exactly 90 rows, one per (month, area, category) in the nested order months `2026-04` to `2026-09`, areas `Tecnologia`, `Operações`, `Comercial`, categories `Infraestrutura`, `Pessoas`, `Licenças`, `Serviços`, `Viagens`, with `date` = month + `-01`, `actual` = round(categoryBase × monthFactor × areaFactor) using bases 420 000, 360 000, 240 000, 180 000, 84 000, month factors 0.79, 0.85, 0.82, 0.91, 0.96, 1 and area factors 1, 0.7, 0.52, and `budget` = round(bases 400 000, 350 000, 250 000, 200 000, 100 000 × month factors 0.82, 0.87, 0.9, 0.94, 0.98, 1 × area factors 1, 0.74, 0.55), so that the first row is `2026-04-01, Tecnologia, Infraestrutura, 331800, 328000`, the last is `2026-09-01, Comercial, Viagens, 43680, 55000`, and the totals are 15 193 059 actual and 16 403 270 budget. |
| FR-00222 | Ubiquitous | Two calls to the demo generator, in any process, SHALL return deep-equal row lists, every row of which passes the Row definition. |
| NFR-00201 | Ubiquitous | Validating a Document at every limit (100 widgets, 20 pages, 30 measures, 20 params, no images) SHALL complete in under 50 ms on the continuous-integration runner, measured as the median of 20 runs. |
| NFR-00202 | Ubiquitous | The schema, formatting and demo modules SHALL contain zero imports of React, Next.js, `node:*`, server or UI modules, verified by the lint script exiting 0 with the import restriction enabled and by a test that fails on the first offending import. |
| NFR-00203 | Ubiquitous | 100 percent of the golden formatting values in this specification SHALL be reproduced byte for byte, including the non-breaking space the pt-BR currency form places after `R$`, on the Node.js version pinned by 001-app-skeleton and in the e2e browser. |
| NFR-00204 | Ubiquitous | Every rejection SHALL carry a dotted field path of at most 200 characters and a pt-BR message of at most 200 characters, so the error envelope defined for the HTTP boundary can transport it unchanged. |

## Open questions

`[NEEDS CLARIFICATION: is the demo dataset anchored to the fixed months 2026-04 to 2026-09 (the prototype) or to the six months ending in the current month? Relative months make the generator depend on a clock and every golden value in this spec and in 003-query-engine becomes a function of the test date.]`

`[NEEDS CLARIFICATION: what is the cap on the total serialised size of a Document? The prototype's only cap was the 1.8 M-character image rule per widget; 100 widgets each carrying an image is about 135 MB, which the persistence layer cannot accept as one JSON column. The cap decides whether images stay inline in the document or become separate uploads.]`

`[NEEDS CLARIFICATION: when a stored document carries a `schemaVersion` older than the current one, is it repaired on read or rejected? Repair means a migration function per version inside the schema module; reject means the persistence layer refuses to open the analysis.]`

`[NEEDS CLARIFICATION: must formatting reproduce the prototype's strings verbatim, including its quirks — compact formatting of −2 500 000 gives `R$ -2500 mil` because the sign is tested before the millions branch, and the month label is capitalised for the six demo months but lowercase for any other month? Verbatim keeps the quirks as golden values; corrected changes two of the golden strings above.]`

`[NEEDS CLARIFICATION: what is the maximum length of a scenario name? The prototype trims the input and defaults to `Cenário` with no limit; 80 characters like versions and templates is assumed until answered.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/002-domain-schema
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

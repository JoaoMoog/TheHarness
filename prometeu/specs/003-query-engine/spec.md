# Specification: Query engine

Status: draft
Owner: João Moog

## Problem

Every number the prototype shows is computed inline by rendering code: `selectRows`
and `metrics` live next to HTML templates in `app.js`, `effectiveRows`, `chartData`
and `proWaterfall` are entangled with SVG strings in `editor-pro.js`, the KPI strip
calls `metrics()` on global state, and the cross-filter is a module variable read
during rendering. The semantics that finance users rely on — a month chart shows
history up to the selected month, page filters override dashboard filters key by
key, the four indicators ignore page filters, a waterfall bridges budget to actual
by category — exist nowhere as a statement that can be tested, and the same
arithmetic is repeated for charts, export, the assistant's narrative and the
insight line. The rewrite needs these rules as pure functions over validated rows
and documents, with golden values, so the studio, the server-side export and the
assistant context all compute the same figures.

## Goal

A pure, deterministic engine that reproduces the prototype's selection, grouping,
trend, metrics, filter inheritance, cross-filter, aggregation, chart data,
waterfall bridge, conditional colour, narrative and insight semantics, pinned by
tests with the demo dataset's golden values.

## Out of scope

- The formula language and evaluation of measure expressions: 004-formula-interpreter.
  This engine takes an evaluator as an input and only defines what it is handed
  and what it does with the answer.
- Scenario arithmetic (bucketing and percentage variation): 016-home-and-planning.
- Rendering of any kind (SVG, tables, KPI cards): 009-svg-charts. The engine
  returns data; it never returns markup.
- Loading rows or documents, caching, pagination, any I/O.
- Deciding when a cross-filter is set or cleared (toggle on the same value,
  clearing on page change): 013-filters-and-interactions. The engine receives a
  cross-filter or nothing.
- Which widget filters a filter widget writes to: 013-filters-and-interactions.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-00301 | Ubiquitous | Given rows and dashboard filters (`period`, `area`, `categories`), the engine SHALL select exactly the rows whose `date` starts with `period` (`AAAA-MM`, compared as strings), whose `area` equals the filter area unless the filter area is `Todas as áreas` or `*`, and whose `category` is in `categories` unless that list is empty. |
| FR-00302 | Ubiquitous | The engine SHALL total a row list as the sum of `actual` and the sum of `budget`, returning `{ actual: 0, budget: 0 }` for an empty list. |
| FR-00303 | Ubiquitous | The engine SHALL group rows by a dimension into `{ label, actual, budget }` entries where the `month` label is the `AAAA-MM` prefix of `date` and the `area` and `category` labels are the row values, ordered ascending by label for `month` and descending by `actual` for the other two, with ties kept in first-seen order. |
| FR-00304 | Ubiquitous | The engine SHALL compute the trend as the month groups of the rows that match the dashboard `area` and `categories` in every period and whose month is less than or equal to the dashboard `period`, keeping only the last 6 months in ascending order, so that the demo dataset with `Tecnologia`, `2026-09`, all categories yields six months with actuals 1 014 360, 1 091 400, 1 052 880, 1 168 440, 1 232 640, 1 284 000. |
| FR-00305 | Ubiquitous | The engine SHALL compute metrics as `actual` and `budget` from the totals of the selected rows, `delta = budget − actual`, `percent = (budget − actual) / budget × 100`, and `forecast` = the arithmetic mean of `actual` over the last 3 (or fewer, when fewer exist) trend months, so that the demo dataset with `Tecnologia`, `2026-09`, all categories yields actual 1 284 000, budget 1 300 000, delta 16 000, percent 1.2307692307692308 and forecast 1 228 360. |
| FR-00306 | Unwanted | IF the selected rows are empty or the totalled budget is 0, THEN metrics SHALL return `actual`, `budget`, `delta` and `forecast` as finite numbers (0 when nothing exists) and `percent` as the value the open question below fixes (0 or `null`), and SHALL NOT return `NaN` or `Infinity` in any field. |
| FR-00307 | Ubiquitous | The engine SHALL resolve a widget's effective filter by starting from the dashboard's `{ area, period, categories }`, then replacing each key present on the page's filter, then each key present on the widget's filter, so that a key absent at a level inherits the level above, a `categories` of `[]` at any level means every category, and an `area` of `*` or `Todas as áreas` at any level means every area. |
| FR-00308 | State | WHILE a widget's `dimension` is `month` and neither its page filter nor its own filter contains `period`, the engine SHALL include every row whose month is less than or equal to the effective `period` (its history); in every other case it SHALL include only rows whose month equals the effective `period`. |
| FR-00309 | Complex | WHEN a cross-filter `{ origin, dimension, value }` is supplied together with the page it was raised on, IF the widget is on that page and is not the origin, THEN the engine SHALL keep only rows whose value for `dimension` (the `AAAA-MM` prefix for `month`) equals `value`, applied after every other filter; the origin widget and widgets on other pages SHALL see their rows unchanged. |
| FR-00310 | Ubiquitous | The dashboard indicator strip SHALL be computed from the rows selected by the dashboard filters alone (FR-00301, FR-00305), unaffected by page filters, widget filters and any cross-filter. |
| FR-00311 | Ubiquitous | The engine SHALL aggregate a row list for a value key as: `none` → `null`; `count` → the number of rows; `actual` or `budget` → over that column, `sum`, `avg` (mean), `count`, `min` or `max` according to the widget's `aggregation`, with 0 for an empty list; a measure id → the result of the injected measure evaluator called with the measure and the scope `{ ...params, realizado: Σactual, orcado: Σbudget, registros: rowCount }`. |
| FR-00312 | Unwanted | IF the value key names a measure that is not in the document, or the measure evaluator reports an error for it, THEN the aggregated value SHALL be `null` and the engine SHALL expose the evaluator's pt-BR message for that widget without throwing. |
| FR-00313 | Ubiquitous | The engine SHALL build chart data by grouping the widget's effective rows by its `dimension` into items `{ key, label, value, comparison, rows }` where `label` is the period label for `month` and the raw value otherwise, `value` and `comparison` come from FR-00311 for the widget's `value` and `comparison` keys, then sorting by `sort` (`label`: `key` compared with pt-BR locale collation; `desc`: `value` descending; `asc`: `value` ascending; a `null` value sorts as 0), then keeping the first `top` items when `top` is greater than 0 and all items when it is 0. |
| FR-00314 | Unwanted | IF `top` exceeds the number of items, or no row matches the effective filter, THEN chart data SHALL be all available items or an empty list respectively, never an error. |
| FR-00315 | Optional | WHERE a widget's `legendField` is not `none`, the engine SHALL derive at most 12 series, one per distinct legend value in first-seen order across the chart items, each holding the aggregated `value` key over the item's rows that carry that legend value, with `null` where an item has no such row. |
| FR-00316 | Ubiquitous | The engine SHALL build a waterfall bridge from chart items when `comparison` is not `none` as: a start bar labelled with the comparison's name whose value is the sum of comparisons, one bar per item whose value is `value − comparison` with `start` at the running total before it and `end` after it, and a total bar labelled with the value's name whose value is the final running total; when `comparison` is `none`, the bars are the items' values accumulated and the total bar is labelled `Total`; so that the demo `Tecnologia`, `2026-09` category bridge with actual over budget is start `Orçamento` 1 300 000, then `Infraestrutura` +20 000, `Licenças` −10 000, `Pessoas` +10 000, `Serviços` −20 000, `Viagens` −16 000, then total `Realizado` 1 284 000. |
| FR-00317 | Ubiquitous | The engine SHALL assign each waterfall bar a colour: the widget's `color` for the start and total bars, `#078e97` for a negative step and the widget's `conditionColor` for a step of zero or more. |
| FR-00318 | Ubiquitous | The engine SHALL compute a mark's colour as the widget's `conditionColor` when `condition` is `budget` and the item's `value` is greater than its `comparison`, or when `condition` is `target` and `value` is greater than the widget's `target`, and the widget's `color` in every other case, where a `null` `value` or `comparison` never satisfies a condition. |
| FR-00319 | Ubiquitous | The engine SHALL name value keys in pt-BR as `actual` → `Realizado`, `budget` → `Orçamento`, `count` → `Registros`, `none` → `Sem comparação`, a measure id → that measure's `name`, an unknown key → `Medida`, and dimensions as `month` → `Mês`, `area` → `Área`, `category` → `Categoria`; the table delta of an item SHALL be `null` when its comparison is `null` and `value − comparison` otherwise. |
| FR-00320 | Ubiquitous | The engine SHALL produce the insight sentence for dashboard filters as `<Área> está <p>% <abaixo|acima> do orçamento. <lista> ultrapassam o planejado. <primeira> representa <s>% do custo total.` where `<Área>` is the filter area or `As áreas selecionadas` for every area, `<p>` is the absolute percent with one decimal and a comma, `abaixo` when delta ≥ 0, `<lista>` is the categories with `actual > budget` joined by ` e ` (the sentence becomes `Todas as categorias estão dentro do planejado.` when none), `<primeira>` is the category with the highest actual and `<s>` its share of the total actual rounded to an integer; so the demo `Tecnologia`, `2026-09` yields `Tecnologia está 1,2% abaixo do orçamento. Infraestrutura e Pessoas ultrapassam o planejado. Infraestrutura representa 33% do custo total.` |
| FR-00321 | Unwanted | IF no row matches the dashboard filters, THEN the insight SHALL be exactly `Nenhum registro corresponde aos filtros. Amplie o período ou selecione outra área.` |
| FR-00322 | Ubiquitous | The engine SHALL produce the month-over-month narrative from the trend as `O realizado foi <atual>, contra <anterior> em <mês anterior em minúsculas>. Variação de <v>%.` with amounts in the zero-decimal currency form, `<v>` = (current − prior) / prior × 100 with one decimal and a comma, so the demo `Tecnologia`, `2026-09` yields `O realizado foi R$ 1.284.000, contra R$ 1.232.640 em agosto de 2026. Variação de 4,2%.`; when the prior actual is 0 the last sentence SHALL be `Variação de base anterior igual a zero.`; when there is no prior month the whole text SHALL be `Não há mês anterior disponível nesta fonte.` |
| FR-00323 | Ubiquitous | Every engine function SHALL be a pure function of its arguments: called twice with deep-equal inputs it SHALL return deep-equal outputs, SHALL NOT mutate its inputs, and SHALL NOT read the clock, random numbers, environment or global state. |
| NFR-00301 | Ubiquitous | Computing chart data for 100 widgets over 5 000 rows on one thread SHALL complete in under 200 ms on the continuous-integration runner, measured as the median of 10 runs after one warm-up. |
| NFR-00302 | Ubiquitous | The engine's source SHALL contain zero occurrences of `Date.now`, `new Date(` without an argument, `Math.random`, `performance.now`, `process.env` or `globalThis`, verified by a test that scans the engine directory. |
| NFR-00303 | Ubiquitous | The engine SHALL import nothing from React, Next.js, `node:*`, server or UI modules, verified by the lint script exiting 0 with the import restriction enabled. |
| NFR-00304 | Ubiquitous | The golden fixtures in this specification SHALL be asserted in at least 12 tests that run in the node environment, and the same test file SHALL pass unchanged in the jsdom environment, proving identical results on both sides. |

## Open questions

`[NEEDS CLARIFICATION: when fewer than 3 trend months exist, is the forecast the mean of the available months (prototype: one month gives that month's actual, none gives 0) or should it be undefined below 3? Undefined changes the metrics shape to a nullable forecast and the indicator's text.]`

`[NEEDS CLARIFICATION: when the totalled budget is 0, is percent 0 (prototype) or null? Null makes the indicator, insight and narrative branch on absence; 0 reports "0,0% abaixo do orçamento" for a period with spend and no budget.]`

`[NEEDS CLARIFICATION: the group ordering "descending by actual" is used by the insight and by grouped totals regardless of which value a widget shows; should chart data with value = budget or a measure still use its own sort keys (prototype) or fall back to actual? It decides whether one grouping function serves both paths.]`

`[NEEDS CLARIFICATION: must the insight and narrative strings match the prototype verbatim, including its grammar quirk when only one category exceeds budget ("Infraestrutura ultrapassam o planejado")? Verbatim keeps the quirk as a golden value; corrected needs a singular/plural rule and a second golden sentence.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/003-query-engine
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

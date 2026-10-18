# Implementation plan: Query engine

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: the forecast is the mean of the available trend months (0 when none);
percent is `0` when the budget is 0; grouped totals for the insight and the trend
always order by `actual` while chart data keeps its own `sort`; the insight and
narrative strings are reproduced verbatim, grammar quirk included. A different
answer changes the marked steps only.

## Approach

Port each prototype function as a pure TypeScript function in `src/core/engine`
that takes rows, the document (or the widget and page it needs) and explicit
context — dashboard filters, an optional cross-filter, a measure evaluator — and
returns plain data. The measure evaluator is an injected interface so this spec
is green before 004-formula-interpreter lands (a stub returns an error for
every measure), and the narrative functions take the numbers the metrics
produced rather than recomputing them. Rejected: a query-builder object
(`engine.for(document).page(p).widget(w).rows()`) — it hides which inputs a
result depends on, which is exactly what the determinism tests need explicit.
Rejected: computing everything on the server — `_decisions.md` runs the engine
in the browser for the studio and on the server for export and assistant
context; this module is the shared half.

## Reuse found

- `src/core/schema` (planned in 002-domain-schema): `Row`, `Widget`, `Page`,
  `Document`, `Filter`, `Measure`, `Params` types and `LIMITS`; nothing is
  redeclared here.
- `src/core/format/number.ts` and `period.ts` (planned in 002-domain-schema):
  `money`, `periodLabel` for the narrative and chart labels.
- `src/core/demo/rows.ts` (planned in 002-domain-schema): the 90-row fixture
  every golden test uses.
- The prototype supplies semantics, not code: `dist/app.js` (`selectRows`,
  `totals`, `group`, `trendRows`, `metrics`, `insight`), `dist/editor-pro.js`
  (`effectiveRows`, `aggregateValue`, `chartData`, `proWaterfall`, `markColor`,
  `valueName`, `dimValue`, `proChart` series), `dist/studio-engine.js`
  (`studioKpis`, `studioChat` month-over-month branch).
- Genuinely new: the `MeasureEvaluator` interface, the explicit cross-filter
  argument (the prototype used a module variable), the error surface for
  measures, and the 5 000-row performance fixture.

## Files

| File | Change |
|---|---|
| `src/core/engine/select.ts` | created: `selectRows`, `totals`, `group`, `trendRows`, `dimValue` |
| `src/core/engine/metrics.ts` | created: `metrics` with delta, percent (assumption: 0 on zero budget), forecast |
| `src/core/engine/filters.ts` | created: `resolveFilter` (dashboard → page → widget), `effectiveRows` with the month-history rule and the cross-filter step |
| `src/core/engine/aggregate.ts` | created: `aggregateValue`, `MeasureEvaluator` interface, `stubEvaluator` returning an error for every measure |
| `src/core/engine/chartData.ts` | created: `chartData`, `seriesData` (legend field), `valueName`, `dimensionName`, `tableDelta` |
| `src/core/engine/waterfall.ts` | created: `waterfallBars` with start, steps, total and per-bar colour |
| `src/core/engine/color.ts` | created: `markColor` |
| `src/core/engine/narrative.ts` | created: `insight`, `monthOverMonth`, the pt-BR constants |
| `src/core/engine/kpis.ts` | created: `dashboardKpis` over dashboard filters only |
| `src/core/engine/index.ts` | created: barrel |
| `src/core/engine/fixtures.ts` | created: `bigRows(5000)` deterministic generator for the performance test (seeded LCG, no clock) |
| `src/core/engine/*.test.ts` | created: one test per requirement id, golden values from the demo dataset |
| `src/core/engine/engine.perf.test.ts` | created: NFR-00301 |
| `src/core/engine/purity.test.ts` | created: NFR-00302 source scan, NFR-00303 import check |

No shared file created by another spec is modified.

## Contracts

- `DashboardFilter = { period: string; area: string; categories: string[] }` — the
  analysis-level triple from `Analysis` in 002.
- `CrossFilter = { origin: string; dimension: Dimension; value: string; pageId: string }`
  — supplied by the caller (013 decides when it exists); `null` when none.
- `MeasureEvaluator = (measure: Measure, scope: Record<string, number>) => { ok: true; value: number } | { ok: false; message: string }`.
  004 supplies the real one; `stubEvaluator` returns
  `{ ok: false, message: "Medida indisponível." }` until then.
- `selectRows(rows, filter, allPeriods?)`, `totals(rows)`, `group(rows, dimension)`,
  `trendRows(rows, filter)`, `metrics(rows, filter)` → `{ actual, budget, delta, percent, forecast }`.
- `resolveFilter(dashboard, page, widget)` → `{ area, period, categories }` with
  `categories` possibly `undefined` (inherit) resolved to the dashboard list.
- `effectiveRows(rows, widget, page, dashboard, cross)`.
- `aggregateValue(rows, key, widget, document, evaluator)` → `number | null`;
  `aggregateWithError(...)` → `{ value, error? }` for FR-00312.
- `chartData(rows, widget, page, dashboard, document, evaluator, cross)` → `ChartItem[]`
  with `ChartItem = { key, label, value: number | null, comparison: number | null, rows: Row[] }`.
- `seriesData(items, widget, document, evaluator)` → `{ name, values: (number | null)[] }[]` (≤ 12).
- `waterfallBars(items, widget, document)` → `{ key, label, value, start, end, color }[]`.
- `markColor(item, widget)` → hex string.
- `insight(rows, filter)`, `monthOverMonth(trend)` → string.
- `dashboardKpis(rows, filter)` → the metrics plus the pt-BR labels the strip shows
  (`Custo realizado`, `Orçamento`, `Saldo disponível` / `Acima do orçamento`,
  `abaixo do orçamento` / `acima do orçamento`).
- Nothing breaking: no consumer exists before 009-svg-charts.

## Order of work

1. Confirm the reused files exist as described (`src/core/schema/index.ts`
   exporting the types, `src/core/format/number.ts`, `src/core/demo/rows.ts`
   returning 90 rows); if not, return blocked. Green: `npm test` passes on the
   002 tree.
2. `select.ts`, `metrics.ts` with golden tests (FR-00301..FR-00306; the
   zero-budget branch is the marked line). Green: `npx vitest run src/core/engine`
   reproduces the six trend actuals and the metrics quadruple.
3. `filters.ts` (FR-00307..FR-00310 with `kpis.ts`). Green: inheritance matrix
   test (absent / `[]` / `*` at each of three levels), month-history test, and a
   cross-filter test with three widgets on two pages.
4. `aggregate.ts`, `chartData.ts` with the stub evaluator (FR-00311..FR-00315,
   FR-00319). Green: sort and top tests, series test, the unknown-measure test
   returns `null` with a message.
5. `waterfall.ts`, `color.ts` (FR-00316..FR-00318). Green: the bridge golden
   sequence and the colour table.
6. `narrative.ts` (FR-00320..FR-00322; verbatim strings are the marked
   constants). Green: the four golden sentences.
7. `fixtures.ts`, `engine.perf.test.ts`, `purity.test.ts`, `index.ts`
   (FR-00323, NFR-00301..NFR-00304). Green: `npm run lint && npm test && npm run build`;
   the perf test reports its median in the output.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `localeCompare` with `pt-BR` differs between Node ICU and browsers for accented labels | chart order differs server/browser, NFR-00304 fails | assert the order of an accented fixture (`ação`, `Área`, `abc`) in both environments; pin Node in 001 |
| The cross-filter as an argument diverges from the prototype's global (which only ever applied to the active page) | widgets on inactive pages filtered by mistake | `CrossFilter.pageId` is compared with the widget's page (FR-00309) and tested with two pages |
| Measure evaluation inside `chartData` runs once per item per key; with 100 widgets × 50 items it dominates the 200 ms budget | NFR-00301 missed once 004 lands | the perf test runs with the stub now and is re-run in 004's plan with the real evaluator; scope objects are built once per item |
| Grouping order "desc by actual" applied to chart data whose value is budget | wrong order in charts | `group` (insight/trend) and `chartData` (widgets) are separate functions with separate tests; the open question records the choice |
| Floating-point sums differ by summation order between environments | golden totals off by 1e-9 | demo values are integers; tests on derived ratios use `toBeCloseTo(…, 9)` |

## Human approval required

None. No authentication, authorisation, cryptography, migration or deletion in
this spec.

## Verification

```
npm ci
npm run lint
npx vitest run src/core/engine
npm test && npm run build
node .github/tools/spec/traceability.mjs --spec=specs/003-query-engine
```

A pass: every golden value and sentence in the spec is asserted by a passing
test; the perf test prints a median under 200 ms for 100 widgets × 5 000 rows;
the purity scan finds zero clock or random calls; the traceability matrix shows
every FR/NFR with at least one test.

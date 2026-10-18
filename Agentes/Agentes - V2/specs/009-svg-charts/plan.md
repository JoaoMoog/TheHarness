# Implementation plan: SVG charts

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: hover stays the native `<title>` (no positioned tooltip), the
legend-field palette is the prototype's six colours moved into `tokens.css` as
`--chart-1` … `--chart-6` with the widget's two colours first, ticks stay the
prototype's five evenly spaced values over the padded range, and more than 50
groups draws the first 50 with the caption `Mostrando os 50 primeiros grupos.`
A different answer changes the marked steps only.

## Approach

Write the eight renderers as pure React function components over plain SVG
elements, with one internal cartesian component behind `column`, `bar`, `line`
and `area` (the prototype already draws those four through one function) and a
tiny linear-scale helper shared with the waterfall. Width comes from the
container through a `ResizeObserver` hook that lives outside the render path,
so `renderToStaticMarkup` on the server produces the same markup at a fixed
default width. Rejected: Recharts or D3 — the bespoke look would be fought at
every step and the server export needs static markup with no client runtime.
Rejected: porting the prototype's string templates as tagged strings — no
type checking of props, no React reconciliation on the canvas, and the escape
discipline would have to be re-invented.

## Reuse found

- `src/core/schema` (planned in 002-domain-schema): the `Widget` type with every
  appearance key, `widgetDefaults`, and the `columns` enum.
- `src/core/format` (planned in 002-domain-schema): `formatValue(n, { unit,
  decimals, format })` giving `R$ 1,23 mi`, `12,5%`, `—` for null and
  `formatMonth(key, style)` for `set./26` labels.
- `src/core/engine` (planned in 003-query-engine): `chartData(widget, rows,
  filters)` returning `{ key, label, value, comparison, rows }[]`,
  `chartSeries(widget, data)` returning `{ name, values }[]` for the legend-field
  split, `waterfallBridge(widget, data)` returning start/end bars, and
  `markColor(item, widget)` for the conditional colour. If 003 exposes the
  series split only through `aggregateValue`, step 2 adds a 20-line adapter in
  `src/ui/charts/series.ts` and nothing else changes.
- `src/styles/tokens.css` (planned in 001-app-skeleton): fonts, text colours.
- Prototype values, not code: `dist/editor-pro.js` `proChart`, `proTable`,
  `proDonut`, `proWaterfall`, `widgetContent` (kpi) for the viewBoxes
  (640×290 column/line/area, 640×max(245, n·38+45) bar, 610×270 donut, 640×280
  waterfall), paddings, tick count, label truncation and every pt-BR string;
  `dist/editor-pro.css` `.pro-plot`, `.gridline`, `.target-line`,
  `.pro-legend`, `.pro-kpi`, `.pro-table-scroll`, `.pro-empty`.

Genuinely new: everything under `src/ui/charts`, the scale helper, the label
thinning and the snapshot fixtures.

## Files

| File | Change |
|---|---|
| `src/ui/charts/types.ts` | created: `ChartProps { widget, data, width?, onSelect? }`, `Series`, `Renderer` |
| `src/ui/charts/scale.ts` | created: linear scale, padded range with negatives and target, five ticks, `axisNumber`, label truncation, thinning step |
| `src/ui/charts/scale.test.ts` | created: FR-00905, FR-00909, FR-00911, NFR-00902 arithmetic |
| `src/ui/charts/Frame.tsx` | created: card frame with title, subtitle, custom properties `--span`, `--card-height`, `--card-font`, inline colours, empty state slot |
| `src/ui/charts/Legend.tsx` | created: swatch list plus `Meta:` entry |
| `src/ui/charts/Empty.tsx` | created: `Nenhum registro para estes filtros.` and the donut variant |
| `src/ui/charts/Cartesian.tsx` | created: shared column/bar/line/area drawing: axes, grid, target line, marks, value labels, `<title>`, selection hook |
| `src/ui/charts/ColumnChart.tsx`, `BarChart.tsx`, `LineChart.tsx`, `AreaChart.tsx` | created: thin wrappers fixing orientation and mark kind |
| `src/ui/charts/DonutChart.tsx` | created: arcs, side labels with percent, centre total |
| `src/ui/charts/WaterfallChart.tsx` | created: bridge and cumulative modes, captions |
| `src/ui/charts/KpiTile.tsx` | created: value, name, comparison line, conditional colour |
| `src/ui/charts/DataTable.tsx` | created: ordered columns, headers, delta, coloured value cell |
| `src/ui/charts/series.ts` | created only if 003 lacks `chartSeries`: legend-field split adapter (marked step) |
| `src/ui/charts/useContainerWidth.ts` | created: `ResizeObserver` hook, default 640 when unavailable |
| `src/ui/charts/index.ts` | created: `rendererFor(type)` registry and re-exports |
| `src/ui/charts/charts.module.css` | created: ported `.pro-plot`, `.gridline`, `.target-line`, legend, kpi, table, empty rules |
| `src/ui/charts/Cartesian.test.tsx`, `DonutChart.test.tsx`, `WaterfallChart.test.tsx`, `KpiTile.test.tsx`, `DataTable.test.tsx`, `Frame.test.tsx` | created: one `it` per FR, jsdom + Testing Library |
| `src/ui/charts/fixtures.ts` | created: deterministic data sets (empty, single, negatives, 12 series, 50 groups, null values) |
| `src/ui/charts/snapshot.test.ts` | created: FR-00922 client vs `renderToStaticMarkup`, NFR-00901 timing, NFR-00903 size, NFR-00905 globals |
| `src/ui/charts/a11y.test.tsx` | created: NFR-00904 with `axe-core` in jsdom over one widget of each type |
| `src/styles/tokens.css` | modified: `--chart-1` … `--chart-6` (palette assumption) |
| `package.json` | modified: `axe-core` devDependency (already transitive through `@axe-core/playwright`; pinned directly for the jsdom scan) |

## Contracts

- `Renderer = (props: ChartProps) => JSX.Element` with `ChartProps { widget:
  Widget; data: ChartDatum[]; width?: number; onSelect?: (key: string) => void }`.
  `data` is exactly the engine's `chartData` output; `width` defaults to 640 and
  is only ever set by `useContainerWidth` on the client.
- `rendererFor(type: Widget["type"]): Renderer | undefined` — `undefined` for
  `text`, `image`, `button`, `filter`, which 011 and 013 render themselves.
- `Frame` props `{ widget, children, empty?: string }` and the custom properties
  it sets on the card root: `--span`, `--card-height` (px), `--card-font` (px).
  010-studio-canvas reads these same properties for the grid.
- Marks carry `data-key="<group key>"`; with `onSelect` they also carry
  `role="button"`, `tabindex="0"` and `aria-label`. 013 attaches its cross-filter
  and details behaviour through `onSelect` only.
- Nothing HTTP. Nothing breaking: the module is new.

## Order of work

1. Confirm the reused files exist as described (`src/core/schema` widget type
   and defaults, `src/core/format` `formatValue`/`formatMonth`, `src/core/engine`
   `chartData`, `chartSeries`, `waterfallBridge`, `markColor`, `tokens.css`); if
   not, return blocked. Green: `npm run lint && npm test` on the untouched tree.
2. `types.ts`, `scale.ts` with tests and the palette tokens (assumption); then `Frame`, `Legend`, `Empty`, `charts.module.css`
   and, if needed, `series.ts` (assumption).
   Green: scale tests for ticks, padding, negatives, target, truncation and
   thinning pass; Frame test for FR-00902 and FR-00916 passes.
3. `Cartesian.tsx` and the four wrappers: two-series mode, legend-field mode,
   axes/grid/labels/legend toggles, target line, conditional colour, null marks,
   selection hook. Green: FR-00903 … FR-00911, FR-00918 … FR-00920 tests pass.
4. `DonutChart`, `KpiTile`. Green: FR-00912, FR-00914, FR-00917 tests pass.
5. `WaterfallChart`, `DataTable`, `useContainerWidth`, `index.ts` registry.
   Green: FR-00913, FR-00915, FR-00921 tests pass; `rendererFor` returns a
   renderer for the eight types and `undefined` for the other four.
6. Fixtures, snapshot/determinism, timing, size, no-globals and axe tests.
   Green: FR-00922, NFR-00901 … NFR-00905 pass; `npm run build` passes;
   traceability shows every id.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| 003's `chartData` shape differs from the assumed `{ key, label, value, comparison, rows }` | every renderer test fixture is wrong | step 1 confirms; fixtures are built through 003's own function on the demo rows, not hand-written, wherever possible |
| `ResizeObserver` is absent in jsdom and on the server | render throws or width is 0 | the hook guards `typeof ResizeObserver`, returns 640, and is never called in `renderToStaticMarkup` paths (NFR-00905 test greps the render path) |
| pt-BR `toLocaleString` output differs between Node ICU builds and browsers (`1.234` vs `1,234`, non-breaking spaces) | snapshot tests flake across machines | formatting goes only through `src/core/format`, whose golden tests already pin the strings; snapshots compare against those helpers, not literals |
| 50 groups × 12 series produces markup over 150 KB | export cap breached later | NFR-00903 test on the worst fixture; value labels are already suppressed beyond two series, `<title>` text is kept short |
| Label thinning hides the label a user expects | confusion with many categories | thinning only starts when overlap is measured against the fixed viewBox; `<title>` on every mark keeps the value reachable; open question on >50 groups |
| Colour contrast of user-chosen `textColor` on `background` | axe reports contrast on the frame | axe scan runs with the default widget colours (which pass); user-chosen colours are the user's, noted in the a11y test |

## Human approval required

Step 6 touches `package.json` (adds `axe-core` as a direct devDependency) and is
Q3: state the change, wait for yes. No authentication, authorisation,
cryptography, schema migration or deletion in this spec.

## Verification

```
npm ci
npm run lint
npx vitest run src/ui/charts
npm test
npm run build
node .github/tools/spec/traceability.mjs --spec=specs/009-svg-charts
```

A pass: every command exits 0; the snapshot test shows the client and
`renderToStaticMarkup` outputs are byte-identical for every fixture; the timing
test reports a median under 16 ms; the axe test reports zero serious/critical;
the matrix shows every FR/NFR with at least one test. Observable in the browser
only after 010-studio-canvas mounts the renderers; until then the jsdom tests
are the whole verification.

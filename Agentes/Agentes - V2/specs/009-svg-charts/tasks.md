# Tasks: SVG charts

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | prop types, linear scale with five ticks, padded range for negatives and target, axis number format, label truncation and thinning step, palette tokens | FR-00905, FR-00909, FR-00911, NFR-00902 | `src/ui/charts/types.ts`, `src/ui/charts/scale.ts`, `src/ui/charts/scale.test.ts`, `src/styles/tokens.css` | `npx vitest run src/ui/charts/scale.test.ts` green, one `it` per id | - | | Q1 |
| T2 | shared frame with custom properties and inline appearance, legend with `Meta:`, empty states, stylesheet | FR-00902, FR-00908, FR-00916, FR-00917 | `src/ui/charts/Frame.tsx`, `src/ui/charts/Legend.tsx`, `src/ui/charts/Empty.tsx`, `src/ui/charts/Frame.test.tsx`, `src/ui/charts/charts.module.css` | `npx vitest run src/ui/charts/Frame.test.tsx` green | T1 | | Q1 |
| T3 | cartesian drawing and the column/bar/line/area wrappers: two-series and legend-field modes, axes/grid/labels toggles, target line, conditional colour, null marks, selection hook (`series.ts` adapter only if 003 lacks `chartSeries`) | FR-00901, FR-00903, FR-00904, FR-00906, FR-00907, FR-00910, FR-00918, FR-00919, FR-00920 | `src/ui/charts/Cartesian.tsx`, `src/ui/charts/Cartesian.test.tsx`, `src/ui/charts/ColumnChart.tsx`, `BarChart.tsx`, `LineChart.tsx`, `AreaChart.tsx` (four five-line siblings) | `npx vitest run src/ui/charts/Cartesian.test.tsx` green, one `it` per id | T2 | | Q1 |
| T4 | donut and indicator renderers | FR-00912, FR-00914 | `src/ui/charts/DonutChart.tsx`, `src/ui/charts/KpiTile.tsx`, `src/ui/charts/DonutChart.test.tsx`, `src/ui/charts/KpiTile.test.tsx` | `npx vitest run src/ui/charts/DonutChart.test.tsx src/ui/charts/KpiTile.test.tsx` green | T2 | P | Q1 |
| T5 | waterfall (bridge and cumulative) and table renderers | FR-00913, FR-00915 | `src/ui/charts/WaterfallChart.tsx`, `src/ui/charts/DataTable.tsx`, `src/ui/charts/WaterfallChart.test.tsx`, `src/ui/charts/DataTable.test.tsx` | `npx vitest run src/ui/charts/WaterfallChart.test.tsx src/ui/charts/DataTable.test.tsx` green | T2 | P | Q1 |
| T6 | container-width hook and the `rendererFor` registry | FR-00921 | `src/ui/charts/useContainerWidth.ts`, `src/ui/charts/index.ts`, `src/ui/charts/index.test.ts` | registry test: eight types map to a renderer, four to `undefined`; hook returns 640 without `ResizeObserver` | T3, T4, T5 | | Q1 |
| T7 | fixtures, client-vs-static determinism, timing, markup size, no-globals grep and the jsdom axe scan with `axe-core` | FR-00922, NFR-00901, NFR-00903, NFR-00904, NFR-00905 | `src/ui/charts/fixtures.ts`, `src/ui/charts/snapshot.test.ts`, `src/ui/charts/a11y.test.tsx`, `package.json` | `npx vitest run src/ui/charts` green; `npm run build` passes; traceability shows no GAP | T6 | | Q3 |

Seven tasks rather than six because eight renderers plus their tests cannot
fit in six tasks of at most four files each; T4 and T5 are the split. T7 is Q3
because it writes the dependency manifest (`axe-core` devDependency): state the
plan, wait for yes. Nothing here is Q4.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no text/image/button/filter
      renderers, no custom tooltip, no animation, no card chrome, the renderers
      are not mounted on any route until 010-studio-canvas, the four open
      questions and the assumptions the plan took for them.

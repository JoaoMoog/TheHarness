# Tasks: Query engine

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | selection, totals, grouping, trend and metrics with the demo golden values | FR-00301, FR-00302, FR-00303, FR-00304, FR-00305, FR-00306 | `src/core/engine/select.ts`, `src/core/engine/metrics.ts` (+ `*.test.ts`) | FR-00301..FR-00306 unit tests (six trend actuals, metrics quadruple, empty and zero-budget cases) | - | | Q1 |
| T2 | filter inheritance, month history, cross-filter step, dashboard KPI strip | FR-00307, FR-00308, FR-00309, FR-00310 | `src/core/engine/filters.ts`, `src/core/engine/kpis.ts` (+ `*.test.ts`) | FR-00307..FR-00310 unit tests: 3-level inheritance matrix, history vs exact period, origin and other-page exemption, strip ignoring page filters | T1 | | Q1 |
| T3 | aggregation with the injected evaluator and its stub, chart data, series, names and table delta | FR-00311, FR-00312, FR-00313, FR-00314, FR-00315, FR-00319 | `src/core/engine/aggregate.ts`, `src/core/engine/chartData.ts` (+ `*.test.ts`) | FR-00311..FR-00315, FR-00319 unit tests; unknown measure gives `null` + message | T2 | | Q1 |
| T4 | waterfall bridge and mark colour | FR-00316, FR-00317, FR-00318 | `src/core/engine/waterfall.ts`, `src/core/engine/color.ts` (+ `*.test.ts`) | FR-00316..FR-00318 unit tests: the seven-bar golden bridge, colour table including `null` comparison | T3 | | Q1 |
| T5 | insight and month-over-month narrative with verbatim pt-BR strings | FR-00320, FR-00321, FR-00322 | `src/core/engine/narrative.ts` (+ `*.test.ts`) | FR-00320..FR-00322 unit tests: four golden sentences | T1 | P | Q1 |
| T6 | deterministic 5 000-row fixture, performance test, purity scan, barrel | FR-00323, NFR-00301, NFR-00302, NFR-00303, NFR-00304 | `src/core/engine/fixtures.ts`, `src/core/engine/engine.perf.test.ts`, `src/core/engine/purity.test.ts`, `src/core/engine/index.ts` | perf median < 200 ms printed; purity scan zero hits; golden file passes under `node` and `jsdom`; `npm run lint && npm run build` exit 0 | T4, T5 | | Q1 |

Six tasks rather than five because the aggregation/chart pair and the
waterfall/colour pair each carry enough golden cases to be verified alone. Every
task is Q1: pure functions with unit tests, no boundary, no secret, no
migration. Nothing here is Q3 or Q4.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no formula evaluation (the
      stub evaluator errors on every measure until 004), no scenario maths, no
      rendering, no I/O, cross-filter lifecycle left to 013, the four open
      questions and the assumptions the plan took for them (mean of available
      months, percent 0 on zero budget, separate group/chart ordering, verbatim
      strings).

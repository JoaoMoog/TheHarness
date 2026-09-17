# Tasks: Domain schema

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | limits, identifiers, Row and Filter schemas, issue-to-envelope mapping | FR-00201, FR-00206, FR-00208, NFR-00204 | `src/core/schema/limits.ts`, `src/core/schema/id.ts`, `src/core/schema/row.ts`, `src/core/schema/filter.ts`, `src/core/schema/errors.ts` (+ `*.test.ts` siblings) | FR-00201, FR-00206, FR-00208, NFR-00204 unit tests | - | | Q1 |
| T2 | Widget schema (strict, every key), enumerations, ranges, image rule, `newWidget` defaults and per-type overrides | FR-00202, FR-00203, FR-00204, FR-00205, FR-00207, FR-00214, FR-00215 | `src/core/schema/widget.ts`, `src/core/schema/widgetDefaults.ts` (+ `*.test.ts`) | FR-00202..FR-00207, FR-00214, FR-00215 unit tests; boundary sweep of every range | T1 | | Q1 |
| T3 | Page, Measure, Params, Document schemas, `defaultDocument`, consistency refinements, size guard, parse benchmark | FR-00209, FR-00210, FR-00211, FR-00212, FR-00213, NFR-00201 | `src/core/schema/page.ts`, `src/core/schema/measure.ts`, `src/core/schema/params.ts`, `src/core/schema/document.ts` (+ `*.test.ts`) | FR-00209..FR-00213 unit tests; NFR-00201 benchmark median < 50 ms | T2 | | Q1 |
| T4 | pt-BR formatting (widget number, money, compact, axis, period labels) with the golden table | FR-00217, FR-00218, FR-00219, FR-00220, NFR-00203 | `src/core/format/number.ts`, `src/core/format/period.ts`, `src/core/format/index.ts` (+ `*.test.ts`) | FR-00217..FR-00220 golden tests; NFR-00203 code-point assertions | T1 | P | Q1 |
| T5 | Analysis, Version, Template, Scenario schemas; demo generator; barrels; purity test | FR-00216, FR-00221, FR-00222, NFR-00202 | `src/core/schema/analysis.ts`, `src/core/schema/index.ts`, `src/core/demo/rows.ts`, `src/core/purity.test.ts` (+ `*.test.ts`) | FR-00216, FR-00221, FR-00222 unit tests; NFR-00202 purity test fails on an injected `import "react"`; `npm run lint && npm run build` exit 0 | T3 | | Q1 |

Every task is Q1: pure modules with unit tests, no boundary, no secret, no
migration, nothing to confirm before running. Nothing here is Q3 or Q4.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no computation over rows,
      no formula parsing, no persistence, no UI, the legacy analysis fields and
      the `selected` key dropped, the five open questions and the assumptions the
      plan took for them (fixed months, 4 MB cap, reject old `schemaVersion`,
      two formatting quirks corrected, scenario name 80).

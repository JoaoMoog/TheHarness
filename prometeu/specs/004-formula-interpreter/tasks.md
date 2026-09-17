# Tasks: Formula interpreter

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | error catalogue, normalisation and tokeniser with the join check, token cap and length guard | FR-00401, FR-00402, FR-00403, FR-00404, FR-00405, FR-00415 | `src/core/formula/errors.ts`, `src/core/formula/tokenize.ts` (+ `*.test.ts`) | FR-00401..FR-00405, FR-00415 unit tests: token table, stray-character table, 119/121-token pair, 301-character string | - | | Q1 |
| T2 | recursive-descent evaluator returning result values: grammar, unary sign, scope lookup, the four runtime messages, finite check | FR-00406, FR-00407, FR-00408, FR-00409, FR-00410, FR-00411, FR-00412, FR-00413, FR-00414, FR-00419 | `src/core/formula/evaluate.ts`, `src/core/formula/index.ts` (+ `*.test.ts`) | FR-00406..FR-00414, FR-00419 unit tests: every golden expression and message in the spec; never-throws sweep over 200 random strings | T1 | | Q1 |
| T3 | measure evaluator and display defaults; wire as the engine's default evaluator | FR-00416, FR-00417, FR-00418 | `src/core/formula/measure.ts`, `src/core/engine/aggregate.ts`, `src/core/engine/aggregate.test.ts` | FR-00416..FR-00418 tests: `realizado / colaboradores` over demo rows gives 12 840; another measure's id gives `null` + `Variável desconhecida: …`; `npx vitest run src/core/engine` still green | T2 | | Q1 |
| T4 | safety scan, lint rule scope, depth and heap check, performance test | NFR-00401, NFR-00402, NFR-00403, NFR-00404 | `src/core/formula/safety.test.ts`, `src/core/formula/formula.perf.test.ts`, `eslint.config.mjs` | scan zero hits and fails on an injected `eval(`; lint reports the three rules as errors; perf median < 100 ms printed; depth test at 59 nested parentheses passes | T3 | | Q1 |

Every task is Q1: pure modules with unit tests and a lint configuration change
that only tightens rules. T4 edits `eslint.config.mjs`, a shared file from
001-app-skeleton, by adding a scoped override; it is not a dependency manifest
or CI change, so it stays Q1. Nothing here is Q3 or Q4.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no measure editor or
      preview line, no functions, exponentiation, comparisons or measure-to-measure
      references, no error positions, the three open questions and the
      assumptions the plan took for them (comma decimals kept, no position, no
      cross-measure references).

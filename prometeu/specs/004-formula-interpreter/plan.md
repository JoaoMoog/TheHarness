# Implementation plan: Formula interpreter

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: comma decimals stay accepted; errors carry no position (the message
alone, as the prototype); a measure cannot reference another measure. A
different answer changes the marked steps only.

## Approach

Port the prototype's recursive-descent evaluator as three small pure modules
(`tokenize`, `parse`+`evaluate` in one pass, `errors`) that return a result
value instead of throwing, then hand the query engine a `measureEvaluator`
built on it and replace 003's stub. The grammar is small enough that parsing and
evaluating in one recursive pass (as the prototype does) is simpler and faster
than building an AST; the token cap bounds recursion depth. Rejected: an
expression library (`mathjs`, `expr-eval`) — each accepts far more than the
five operators (functions, exponentiation, implicit multiplication), which
would silently widen the contract and the attack surface; the safety proof
becomes "trust the library". Rejected: an AST with a separate evaluator —
worth it only if the assistant needs to rewrite formulas, which nobody asked for.

## Reuse found

- `src/core/schema/measure.ts` and `params.ts` (planned in 002-domain-schema):
  `Measure`, `Params` types and `EXPRESSION_MAX` (300) in `LIMITS`; the
  interpreter reads the limit, never redefines it.
- `src/core/engine/aggregate.ts` (planned in 003-query-engine): the
  `MeasureEvaluator` interface and `stubEvaluator`; this plan modifies that
  file to export a `defaultEvaluator` that is the real one.
- `eslint.config.mjs` (planned in 001-app-skeleton): the `src/core` import
  restriction exists; this plan adds `no-eval`, `no-new-func`,
  `no-implied-eval` as errors for `src/core/formula/**` (they may already be
  on globally; adding them scoped is idempotent).
- The prototype supplies the semantics: `dist/pro-core.js` `calculateFormula`
  (regex, join check, 120 cap, grammar, five messages) and
  `dist/editor-pro.js` (measure assignment copying `format` and `decimals`).
- Genuinely new: the result-value API, the error catalogue as constants, the
  length guard, the safety scan test and the performance test.

## Files

| File | Change |
|---|---|
| `src/core/formula/errors.ts` | created: the five pt-BR messages as constants, `FormulaError` result type |
| `src/core/formula/tokenize.ts` | created: normalisation (lower-case, comma → dot), token regex, join check, 120-token cap |
| `src/core/formula/evaluate.ts` | created: recursive-descent `sum`/`product`/`atom` returning a result value; scope lookup via own properties |
| `src/core/formula/measure.ts` | created: `measureEvaluator` implementing 003's `MeasureEvaluator`; `measureDisplayDefaults(measure)` |
| `src/core/formula/index.ts` | created: barrel: `evaluateFormula(expression, scope)`, `FORMULA_ERRORS`, `measureEvaluator`, `measureDisplayDefaults` |
| `src/core/formula/*.test.ts` | created: one test per requirement id; the golden table from the spec |
| `src/core/formula/safety.test.ts` | created: NFR-00402 source scan, NFR-00404 depth and heap checks |
| `src/core/formula/formula.perf.test.ts` | created: NFR-00401 |
| `src/core/engine/aggregate.ts` | modified: export `defaultEvaluator = measureEvaluator`; `stubEvaluator` kept for tests |
| `src/core/engine/aggregate.test.ts` | modified: FR-00416 integration case with a real measure over demo rows |
| `eslint.config.mjs` | modified: `no-eval`, `no-new-func`, `no-implied-eval` as errors for `src/core/formula/**` |

## Contracts

- `evaluateFormula(expression: string, scope: Record<string, number>): FormulaResult`
  with `FormulaResult = { ok: true; value: number } | { ok: false; message: string }`.
  Never throws for a string input; a non-string input is a type error at compile
  time, not a runtime branch.
- `FORMULA_ERRORS = { chars, parens, unknownPrefix, incomplete, divisionByZero, invalid }`
  — `unknownPrefix` is `Variável desconhecida: ` and `incomplete` is
  `unknownPrefix + "expressão incompleta"` (FR-00409).
- `measureEvaluator: MeasureEvaluator` (from 003):
  `(measure, scope) => FormulaResult`; the scope is built by the engine as
  `{ ...params, realizado, orcado, registros }`.
- `measureDisplayDefaults(measure): { format: Measure["format"]; decimals: 1 | 2 }`
  (FR-00417), consumed by 014-measures-and-parameters-ui.
- `src/core/engine/aggregate.ts` gains `defaultEvaluator`; its signature and the
  `MeasureEvaluator` type are unchanged, so nothing is breaking for 003's tests.
- The token limit (120) and the length limit (300, from `LIMITS.EXPRESSION_MAX`)
  are exported as `FORMULA_LIMITS` for 014's editor to display.

## Order of work

1. Confirm the reused files exist as described (`src/core/engine/aggregate.ts`
   exporting `MeasureEvaluator` and `stubEvaluator`, `LIMITS.EXPRESSION_MAX`
   in `src/core/schema/limits.ts`, the `src/core` lint restriction); if not,
   return blocked. Green: `npm test` passes on the 003 tree.
2. `errors.ts`, `tokenize.ts` with tests (FR-00401..FR-00405, FR-00415; comma
   handling is the marked line). Green: `npx vitest run src/core/formula`
   passes the tokeniser table including the 119/121-token pair.
3. `evaluate.ts` with tests (FR-00406..FR-00414, FR-00419). Green: every golden
   expression in the spec returns its value or its exact message.
4. `measure.ts`, `index.ts`; modify `src/core/engine/aggregate.ts` and its test
   (FR-00416, FR-00417, FR-00418). Green: a column widget with value
   `m1 = realizado / colaboradores` over the demo `Tecnologia`, `2026-09` rows
   yields 12 840 for the single month item; an unknown identifier yields `null`
   with the message; 003's whole suite still passes.
5. `safety.test.ts`, `formula.perf.test.ts`, the eslint rule scope
   (NFR-00401..NFR-00404). Green: `npm run lint && npm test && npm run build`;
   the safety test fails when a commented-out `eval(` is inserted in
   `evaluate.ts` and passes when removed; 003's perf test is re-run with the
   real evaluator and still reports under 200 ms.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Comma → dot normalisation turns `1.000,50` into `1.000.50`, which the join check refuses with the generic message | users pasting formatted numbers get a message that does not say why | the open question; if kept, 014 shows the limits hint next to the field; the test table includes `1.000,50` → `Use números…` |
| Deep parentheses recurse once per level; 59 levels is fine, but a future cap raise could overflow | stack overflow escapes as a throw, breaking FR-00414 | NFR-00404 test pins depth at the cap; `evaluateFormula` wraps the pass in a guard that converts any unexpected throw into `Expressão inválida.` |
| Lint rules `no-eval` etc. already global in 001 with a different severity | duplicate config or a warning downgrade | scope the override to `src/core/formula/**` and assert severity `error` in `safety.test.ts` by reading the resolved config |
| The engine's `stubEvaluator` remains the one wired in some caller | measures show `Medida indisponível.` in production | `defaultEvaluator` is the only export 009+ import; the stub is exported from a `testing` sub-path only |
| Numeric conversion of a scope value that is not a number (should be impossible after 002) | `NaN` result | `Number()` conversion then the finite check makes it `Expressão inválida.`; a test injects a `NaN` parameter |

## Human approval required

None. No authentication, authorisation, cryptography, migration or deletion in
this spec. The safety property (no JavaScript evaluation) is enforced by tests
and lint, not by review.

## Verification

```
npm ci
npm run lint
npx vitest run src/core/formula src/core/engine
npm test && npm run build
node .github/tools/spec/traceability.mjs --spec=specs/004-formula-interpreter
```

A pass: every expression in the spec's tables returns the stated value or the
exact message; the safety scan reports zero hits and the three lint rules are
errors; the perf test prints a median under 100 ms for 10 000 evaluations;
003's suite passes with the real evaluator; the traceability matrix shows every
FR/NFR with at least one test.

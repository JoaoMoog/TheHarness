# Implementation plan: Domain schema

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: the demo months are fixed at 2026-04 to 2026-09; the total document
size cap is 4 MB serialised (checked as a string-length guard before parsing);
an older `schemaVersion` is rejected on read with the code `schema_version_unsupported`
(no repair function until a second version exists); formatting reproduces the
prototype verbatim except the two quirks named in the question, which are
corrected (`R$ -2,50 mi`, month names always capitalised); scenario names are
capped at 80 characters. A different answer changes the marked steps only.

## Approach

Write every domain object as one zod schema in `src/core/schema`, export its
`z.infer` type from the same file, and keep limits and enumerations in a single
`limits.ts` so 003, 007, 008, 011 and 018 read the same constants. Formatting
and the demo generator are pure functions beside the schema, all under the
`src/core` import restriction so the identical code runs in Route Handlers and
in the browser. Rejected: porting `cleanPro` as a "lenient parse" mode next to
the strict one — two parse paths mean two sets of tests and a boundary that
can silently pick the lenient one; the decision in `_decisions.md` is reject,
never clamp. Rejected: generating the schema from a JSON Schema document — it
adds a build step for twelve objects and loses zod's refinements (document
consistency, image data URL).

## Reuse found

- `eslint.config.mjs`, planned in 001-app-skeleton, already carries the
  `no-restricted-imports` rule for `src/core`; this plan adds a test that
  exercises it, not the rule.
- `vitest.config.ts`, planned in 001-app-skeleton, runs `src/core/**` in the
  node environment; nothing to change.
- The prototype supplies values, not code: `dist/pro-core.js` (`proDefaults`,
  `cleanPro`, `proTypes`, `proDimensions`), `dist/app.js` (`demoRows`, `months`,
  `money`, `compact`, `validateRows`), `dist/editor-pro.js` (`numberPro`,
  `addProWidget`), `dist/studio-engine.js` (`axisNumber`).
- Genuinely new: every file below. No domain type exists in the repository
  before this spec.

## Files

| File | Change |
|---|---|
| `src/core/schema/limits.ts` | created: every numeric range, length limit, count cap, enumeration list and reserved-name list as named constants |
| `src/core/schema/id.ts` | created: identifier and measure-id patterns with the prototype-pollution exclusion |
| `src/core/schema/row.ts` | created: Row schema with the calendar-date refinement |
| `src/core/schema/filter.ts` | created: Filter schema (`area`, `period`, `categories`) |
| `src/core/schema/widget.ts` | created: Widget schema, strict object, every key required |
| `src/core/schema/widgetDefaults.ts` | created: `newWidget(type, id)` with the base defaults and per-type overrides, type labels |
| `src/core/schema/page.ts` | created: Page schema |
| `src/core/schema/measure.ts` | created: Measure schema |
| `src/core/schema/params.ts` | created: Params schema with key pattern and reserved names |
| `src/core/schema/document.ts` | created: Document schema, `defaultDocument()`, consistency refinements, size guard |
| `src/core/schema/analysis.ts` | created: Analysis metadata, Version, Template, Scenario schemas |
| `src/core/schema/errors.ts` | created: maps a zod issue to `{ code, message, field }` with pt-BR messages |
| `src/core/schema/index.ts` | created: barrel of schemas and types |
| `src/core/format/number.ts` | created: `formatNumber(n, { unit, decimals, format })`, `money`, `compact`, `axisNumber`, the `—` rule |
| `src/core/format/period.ts` | created: `periodLabel`, `periodShort` |
| `src/core/format/index.ts` | created: barrel |
| `src/core/demo/rows.ts` | created: `demoRows()` generator with the bases and factors as constants |
| `src/core/schema/*.test.ts`, `src/core/format/*.test.ts`, `src/core/demo/rows.test.ts` | created: one test per requirement id |
| `src/core/purity.test.ts` | created: NFR-00202, scans `src/core/**` imports |

No shared file created by another spec is modified.

## Contracts

- `parseDocument(input: unknown): Document` throws a `SchemaError` whose
  `issues[0]` is `{ code: "invalid_document", message: <pt-BR>, field: "widgets.w1.span" }`;
  `safeParseDocument(input)` returns `{ ok: true, value } | { ok: false, error }`.
  Every other object exposes the same pair (`parseRow`/`safeParseRow`, …). The
  `field` value is the dotted zod path; array indices are numeric segments.
- `newWidget(type: WidgetType, id: string): Widget` (FR-00214, FR-00215) is the
  only place defaults are applied; `parseWidget` never fills a missing key.
- `defaultDocument(): Document` (FR-00211).
- `formatNumber(n: number | null, opts: { unit, decimals, format }): string`,
  `money(n)`, `compact(n)`, `axisNumber(n, max)`, `periodLabel(p)`, `periodShort(p)`.
- `demoRows(): Row[]` — 90 rows, no arguments, no clock (assumption: fixed months).
- `LIMITS` object: `WIDGETS_MAX 100`, `PAGES_MAX 20`, `MEASURES_MAX 30`,
  `PARAMS_MAX 20`, `CATEGORIES_MAX 100`, `TITLE_MAX 150`, `SUBTITLE_MAX 200`,
  `TEXT_MAX 4000`, `PAGE_NAME_MAX 60`, `MEASURE_NAME_MAX 70`, `EXPRESSION_MAX 300`,
  `IMAGE_MAX_CHARS 1800000`, `DOCUMENT_MAX_BYTES` (assumption 4 MB), ranges per
  numeric key, enumerations per enum key. Later specs import these; none
  redefines a number.
- Types exported: `Row`, `Filter`, `Widget`, `WidgetType`, `Page`, `Measure`,
  `Params`, `Document`, `Analysis`, `Version`, `Template`, `Scenario`.
- Nothing here is breaking: no consumer exists yet.

## Order of work

1. Confirm the reused files exist as described (`eslint.config.mjs` with the
   `src/core` restriction, `vitest.config.ts` node environment for `src/core`);
   if not, return blocked. Green: `npm run lint && npm test` pass on the 001 tree.
2. `limits.ts`, `id.ts`, `row.ts`, `filter.ts`, `errors.ts` with their tests
   (FR-00201, FR-00206, FR-00208, FR-00213 for rows, NFR-00204). Green:
   `npx vitest run src/core/schema` passes.
3. `widget.ts`, `widgetDefaults.ts` with tests (FR-00202..FR-00207, FR-00214,
   FR-00215). Green: a property-style test parses `newWidget(t, id)` for all
   twelve types and every boundary value of every range; each out-of-range value
   is rejected with its path.
4. `page.ts`, `measure.ts`, `params.ts`, `document.ts` with tests (FR-00209..
   FR-00213, NFR-00201); the size guard uses the assumed 4 MB (marked step).
   Green: the consistency tests and the 50 ms benchmark pass.
5. `analysis.ts` (FR-00216) and `format/*` (FR-00217..FR-00220, NFR-00203) with
   golden tests; the corrected quirks are the marked lines (assumption). Green:
   golden table passes under `npm test`.
6. `demo/rows.ts` (FR-00221, FR-00222; fixed months are the marked constant),
   `index.ts` barrels and `purity.test.ts` (NFR-00202). Green:
   `npm run lint && npm test && npm run build` pass; the purity test fails when a
   temporary `import "react"` is added and passes when removed.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Strict objects reject documents produced by a later spec that adds a key before updating the schema | 400 on every save until both land together | the schema is the only place a key is declared; a later spec's plan lists `src/core/schema/widget.ts` as modified whenever it adds a key |
| `Intl` output differs between Node and the browser (NBSP vs space after `R$`, ICU version) | NFR-00203 golden tests flake | pin the Node line in 001; assert against the exact code points; one e2e assertion renders `money(1284000)` in the browser |
| Zod refinements on a 100-widget document run in quadratic time (page-widget consistency) | NFR-00201 missed | build a `Set` of widget ids once per parse; benchmark in step 4 |
| The 1.8 M-character image rule × 100 widgets exceeds any sane row size | persistence fails on a valid document | the assumed 4 MB serialised cap is enforced before parsing; the open question decides the final number |
| Fixed demo months go stale in 2027 | the "current month" default analysis looks historical | open question; if relative, the generator takes a `now` parameter injected by the caller, never read from the clock inside `src/core` |

## Human approval required

None. No authentication, authorisation, cryptography, migration or deletion in
this spec.

## Verification

```
npm ci
npm run lint
npx vitest run src/core
npm test && npm run build
node .github/tools/spec/traceability.mjs --spec=specs/002-domain-schema
```

A pass: lint exits 0 with the import restriction active; every golden string in
the spec appears in a passing test; the document benchmark reports a median
under 50 ms; `demoRows()` called twice deep-equals and sums to 15 193 059 /
16 403 270; the traceability matrix shows every FR/NFR with at least one test.

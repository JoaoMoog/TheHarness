# Implementation plan: Measures and parameters UI

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: removing a measure in use is refused naming the count; parameters are
per analysis, stored in the document as the prototype did; `Resultado no recorte`
is evaluated on the dashboard recorte; measure names need not be unique. A
different answer changes steps 2, 3 and 5 only.

## Approach

One dialog component owned by the context bar, with a measure form and a
parameters form, both writing through store actions that validate with the
002-domain-schema measure and params schemas before committing one history
snapshot. Live validation is a small hook that debounces the expression, builds the
values object from the engine's dashboard-recorte totals and calls the interpreter
from 004-formula-interpreter, so the dialog shows exactly the message a widget
would. The widget error state reads the per-widget evaluation error the engine
already returns, so the dialog and the canvas can never disagree on a formula.
Rejected: validating on the server through a handler — the interpreter is pure
and runs on the client in the studio by decision, and a round-trip per keystroke
adds latency for no safety gain (the document PUT re-validates the schema anyway).
Rejected: a code-editor component for the formula — a 300-character arithmetic
expression is a plain input with a result line, as in the prototype.

## Reuse found

- `src/core/formula/index.ts` (planned in 004-formula-interpreter): `evaluate(expression, values)`
  throwing or returning a typed error with the pt-BR catalogue in
  `src/core/formula/errors.ts`; limits 300 characters and 120 tokens.
- `src/core/engine/aggregate.ts` (planned in 003-query-engine and wired by
  004-formula-interpreter): measure evaluation over group totals returning a value or
  an error message per group; `selectRows` and `totals` for the dashboard recorte.
- `src/core/schema/measure.ts`, `params.ts`, `limits.ts` (planned in
  002-domain-schema): `MeasureSchema` (id `^m[a-z0-9]+$`, name ≤ 70, expression
  ≤ 300, format), `ParamsSchema` (key regex, reserved names, ≤ 20 entries), the
  30-measure cap.
- `src/ui/studio/store.ts` (planned in 010-studio-canvas): document, selection,
  history; `updateWidget` from 011-widget-editing for the value/format/decimals
  binding.
- `src/ui/studio/ContextBar.tsx` (planned in 010-studio-canvas): the `ƒ Medidas`
  button exists unwired.
- `src/ui/studio/panel/DadosTab.tsx` (planned in 011-widget-editing): `Valor` and
  `Comparação` selects take an options list; this plan extends the list with
  measures.
- `src/ui/studio/WidgetCard.tsx` (planned in 010-studio-canvas) and the renderers
  in `src/ui/charts/` (planned in 009-svg-charts): render `—` for null values
  already; this plan adds the note slot for the error message.
- `src/ui/shell/Modal.tsx`, `ToastProvider.tsx` (planned in 001-app-skeleton);
  `src/core/format` (planned in 002-domain-schema) for the pt-BR number with up to 4
  decimals.
- Genuinely new: the dialog, the two forms, the validation hook, the store actions
  for measures and parameters with the in-use checks, the card error note, and the
  e2e file.

## Files

| File | Change |
|---|---|
| `src/ui/studio/store.ts` | modified: `upsertMeasure(measure)`, `removeMeasure(id)`, `saveParams(values, newKey?, newValue?)`, `removeParam(key)`, `applyMeasureToSelection(measureId, format)`; caps, reserved names, duplicate key and in-use checks return a refusal `{ error: string }` and push no snapshot |
| `src/ui/studio/store.test.ts` | modified: tests for the five actions, every refusal message, one snapshot per successful call |
| `src/ui/studio/measures/useFormulaPreview.ts` | created: 300 ms debounce, values from dashboard recorte totals and params, calls `evaluate`, returns `{ ok, text }` |
| `src/ui/studio/measures/MeasureForm.tsx` | created: `Nome`, `Fórmula`, suggestions, `Formato`, result line, `Validar fórmula`, `Salvar medida`; save disabled until `ok` |
| `src/ui/studio/measures/ParamsForm.tsx` | created: parameter fields with `Remover`, `Novo parâmetro`, `Valor`, `Salvar parâmetros` |
| `src/ui/studio/measures/MeasuresDialog.tsx` | created: `Medidas calculadas` dialog composing the list (`Editar`, `Excluir`), the two forms and the toasts |
| `src/ui/studio/measures/measures.module.css` | created: list, suggestions row, result line |
| `src/ui/studio/measures/useFormulaPreview.test.ts`, `MeasureForm.test.tsx`, `ParamsForm.test.tsx`, `MeasuresDialog.test.tsx` | created: unit tests named by requirement id |
| `src/ui/studio/ContextBar.tsx` | modified: `ƒ Medidas` opens `MeasuresDialog`; hidden for readers |
| `src/ui/studio/panel/DadosTab.tsx` | modified: measure options appended to `Valor` and `Comparação` |
| `src/ui/studio/WidgetCard.tsx` | modified: note slot showing the evaluation error below the content |
| `tests/e2e/014-measures-and-parameters-ui.spec.ts` | created: create, validate, apply, edit, remove, caps, params, error state, undo, reader session, axe, timings |

## Contracts

- Store actions (synchronous; success pushes one history snapshot, refusal pushes
  none and returns the message): `upsertMeasure({ id?, name, expression, format })`
  → `{ id } | { error }` with `Limite de 30 medidas por análise.`;
  `removeMeasure(id)` → `{ error: "Medida em uso por <n> componente(s)." }` when
  referenced; `saveParams(values: Record<string, number>, newKey?: string, newValue?: number)`
  with `Nome de parâmetro inválido ou reservado.`, `Parâmetro já existe.`,
  `Limite de 20 parâmetros por análise.`; `removeParam(key)` with
  `Parâmetro usado em <n> medida(s).`; `applyMeasureToSelection(measureId, format)`
  sets `value`, `format` and `decimals` (1 for percent, else 2) on the single
  selected widget.
- Validation values object: `{ ...params, realizado: totals.actual, orcado: totals.budget, registros: rows.length }`
  over the dashboard recorte; result text `Resultado no recorte: <n>` with pt-BR
  formatting and `maximumFractionDigits: 4`.
- Widget error state: the engine's chart data for a widget carries
  `error?: string` per group and for the total; the card renders the note when any
  is set. If 004's integration returns only `null`, this plan adds a
  `measureError(widget, rows, document)` helper in `src/core/engine` that
  re-evaluates the total to obtain the message (confirmed in step 1).
- Options for `Valor`: `[{ actual: "Realizado" }, { budget: "Orçamento" }, { count: "Registros" }, ...measures.map(m => ({ [m.id]: m.name }))]`;
  `Comparação` prepends `{ none: "Nenhuma" }`.
- No HTTP contract changes; the document PUT of 010-studio-canvas carries
  `measures` and `params`, validated by the schema on the server.

## Order of work

1. Confirm the reused files exist as described (`evaluate` and the error catalogue,
   the measure and params schemas with caps, the store with history and
   `updateWidget`, `ContextBar` with the button, `DadosTab` option lists, the
   engine's per-widget error value or the place to add the helper); if not, return
   blocked. Green: existing suites pass.
2. Store actions with caps, reserved names, duplicate and in-use checks, and their
   tests. Green: `store.test.ts` covers FR-01406, FR-01407, FR-01409, FR-01413,
   FR-01414, FR-01416..FR-01421, NFR-01403.
3. `useFormulaPreview` and `MeasureForm` with suggestions and disabled save.
   Green: tests cover FR-01402..FR-01405.
4. `ParamsForm`, `MeasuresDialog` with list, `Editar`, `Excluir`, toasts;
   `ContextBar` wiring and reader hiding. Green: tests cover FR-01401, FR-01408,
   FR-01410, FR-01415, FR-01423.
5. `DadosTab` measure options and `WidgetCard` error note (plus the engine helper
   if needed). Green: tests cover FR-01411, FR-01412.
6. e2e: full flow with undo after each action, the 30 and 20 caps by fixture, a
   division-by-zero widget, reader session with no PUT, axe, timings. Green:
   `npm run test:e2e` and the traceability command report every id.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The engine may swallow evaluation errors as `null` (prototype behaviour), leaving no message for FR-01412 | card shows `—` with no explanation | step 1 confirms the error value from 004's integration; otherwise the `measureError` helper is added in `src/core/engine`, one function with its test |
| Live validation on every keystroke over 5 000 rows recomputes totals each time | NFR-01401 missed | totals of the dashboard recorte are memoised per document revision and filter; only `evaluate` runs on debounce |
| `applyMeasureToSelection` with a multi-selection would broadcast a data key, which 011 forbids | data keys change on several widgets | the action applies only when exactly one widget is selected (FR-01407); the store test covers the multi-selection no-op |
| Reserved-name and key regex duplicated between the schema and the form | drift between UI refusal and server 400 | the form calls the schema's `paramKey` validator; the store test asserts the same message for the same inputs |
| Deleting a measure referenced only by a widget on another page is missed by a page-scoped check | dangling `value` id, widget renders `—` forever | the in-use scan walks every widget of the document, not the active page; tested with a two-page fixture |
| Route-group paths are not captured by the traceability planned-file regex | false "unrequested change" lines | known landmine in `_context.md`; no route file is touched here |

## Human approval required

None. Measure and parameter removal are document edits inside the undo history,
not data destruction; no authentication, authorisation, cryptography or migration
is touched. The server-side reader check on the document PUT is owned by
010-studio-canvas.

## Verification

```
npm ci
npm run lint && npm test
npx vitest run src/ui/studio/measures src/ui/studio/store.test.ts
npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/014-measures-and-parameters-ui
```

Observable: as an Editor, select a KPI, open `ƒ Medidas`, press `Custo por
colaborador` (result line shows `Resultado no recorte: …`), save (toast `Medida
salva e aplicada ao componente selecionado.`, the KPI shows R$ with 2 decimals);
type `realizado / zero` (result line `Variável desconhecida: zero`, save disabled);
add a parameter `zero` = 0 and save the measure `realizado / zero` on a second
widget (it shows `—` with `Divisão por zero neste recorte.`); try `Excluir` on the
first measure (refused `Medida em uso por 1 componente(s).`); try a parameter named
`orcado` (`Nome de parâmetro inválido ou reservado.`); press Ctrl+Z after each
step and watch it revert. Sign in as a Leitor: no `ƒ Medidas` button, the KPI still
shows its value. A pass: every command exits 0 and the matrix shows every FR/NFR
with at least one test.

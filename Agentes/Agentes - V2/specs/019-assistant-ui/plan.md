# Implementation plan: Assistant interface

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: the transcript lives in the studio store only and is not persisted; the
home page prompt stays deterministic (016-home-and-planning) and this spec adds no
call from it; a Leitor receives proposals and sees `Aplicar alterações` disabled; a
dashboard proposal shows value rows only, no rendered panes. A different answer
changes the marked steps only.

## Approach

The tab is a client island inside the property panel of 011-widget-editing: a hook
posts to the assistant endpoint of 018-assistant-service with an `AbortController`
(30 s), maps the error envelope to a transcript turn, and hands proposals to a
preview modal built on the shell `Modal` of 001-app-skeleton, which renders the
"before" and "after" panes with the chart components of 009-svg-charts fed by the
engine of 003-query-engine. Applying is one store action that snapshots the document
once, so undo behaves like every other edit. Rejected: applying the patch through the
existing per-control actions of 011 in a loop — that would create one undo entry per
key per widget and make "desfazer" restore only the last one. Rejected: keeping the
prototype's browser-side intent table as an offline fallback — two interpreters of
the same sentence would drift, and the service already answers deterministically
when the provider is down.

## Reuse found

- `src/ui/studio/store.ts` (planned in 010-studio-canvas, extended in 011-widget-editing):
  document, selection, multi-selection, `readOnly`, history snapshots, the `commit`
  discipline and the `panelTab` field; this plan adds three actions, one field and one
  `panelTab` value.
- `src/ui/studio/panel/PropertyPanel.tsx` (planned in 011-widget-editing): the tabbed panel
  bound to the selection with its tab routing; this plan adds one tab.
- `src/ui/shell/Modal.tsx` (planned in 001-app-skeleton): focus trap, Escape, focus
  return; the preview modal composes it.
- `src/ui/shell/Rail.tsx` (planned in 001-app-skeleton): the `IA` entry exists as
  chrome; this plan gives it behaviour.
- `src/ui/charts` (planned in 009-svg-charts) and `src/core/engine` (planned in
  003-query-engine): the panes render exactly what the canvas renders.
- `src/core/schema` (planned in 002-domain-schema): the patch is parsed once more on the
  client before it is applied, so a stale service cannot write an invalid key.
- The store's `readOnly` flag (planned in 010-studio-canvas): decides the Leitor state of
  `Aplicar alterações`.
- Genuinely new: the tab, transcript, composer with chips, preview modal, the label maps,
  the request hook and the store actions.

## Files

| File | Change |
|---|---|
| `src/ui/assistant/AssistantTab.tsx` | created: composes transcript, composer, chips, meta line; owns the collapse toggle |
| `src/ui/assistant/Transcript.tsx` | created: turns list, empty-state text, `aria-live="polite"` region, `aria-busy` while waiting, error turns with `Tentar novamente` |
| `src/ui/assistant/Composer.tsx` | created: form with the labelled input and submit button; three chips under `Alterações com prévia`; meta line |
| `src/ui/assistant/PreviewModal.tsx` | created: `Prévia da alteração sugerida` for widget patches (two panes via `src/ui/charts`) and dashboard proposals (value rows); `Cancelar` / `Aplicar alterações`; Leitor note |
| `src/ui/assistant/labels.ts` | created: key → label and value → label maps of FR-01911 |
| `src/ui/assistant/useAssistant.ts` | created: `send(message)` posting `{ message, selection }`, 30 s abort, envelope → error turn mapping, retry of the last message |
| `src/ui/assistant/assistant.module.css` | created: tab, transcript, chips, preview panes |
| `src/ui/assistant/*.test.tsx` | created: co-located Testing Library tests with a mocked `fetch` and fake timers |
| `src/ui/studio/store.ts` | modified: field `transcript` (max 50); `panelTab` gains the value `assistente`; actions `applyWidgetPatch(targets, patch)`, `applyDashboardProposal(proposal)` (one snapshot each), `pushTurn`, `clearTranscript` on load |
| `src/ui/studio/panel/PropertyPanel.tsx` | modified: tab `Assistente` rendering `AssistantTab`, routed by the existing `panelTab` |
| `src/ui/shell/Rail.tsx` | modified: `IA` entry navigates to the current analysis's studio when elsewhere, opens the panel, sets `panelTab` and focuses the input |
| `tests/e2e/019-assistant-ui.spec.ts` | created: with the fake provider scripted through a test hook: chip → preview → apply → undo; 429 turn; rail `IA` focus; axe on tab and modal |

## Contracts

- Consumes `POST /api/analyses/[analysisId]/assistant` exactly as 018-assistant-service
  defines it: request `{ message, selection }`; answers `kind: 'text' | 'widget_patch' | 'dashboard'`;
  errors `{ error: { code, message, field? } }` with `Retry-After` on 429.
- Store actions: `applyWidgetPatch(targets: string[], patch: WidgetPatch)` returns the number of
  widgets changed and records one history snapshot; `applyDashboardProposal({ area, period, chartType })`
  records one snapshot; `pushTurn({ role, text, error? })` trims to 50; the existing `panelTab` union gains `'assistente'`.
- `WidgetPatch` type is the client-side parse of the allowlisted widget keys from `src/core/schema`.
- The rail's `IA` entry becomes a client component that reads the current analysis id from the
  route; other rail entries are unchanged.
- Nothing breaking: the panel gains a tab, the store gains fields with defaults.

## Order of work

1. Confirm the reused files exist as described: the store with history snapshots,
   multi-selection, `readOnly` and `panelTab`, the tabbed `panel/PropertyPanel.tsx`, the shell `Modal`, the `Rail` with an `IA`
   entry, the chart renderers and the engine, and the assistant endpoint contract. If not,
   return blocked. Green: nothing changes.
2. Store field, `panelTab` value and actions with tests. Green: FR-01912 (one undo restores every target),
   FR-01914 (cancel leaves no entry), FR-01915 (missing target skipped), FR-01918 (dashboard
   apply), FR-01923 (cleared on load), NFR-01903 (cap 50) store tests.
3. Label maps and the request hook with a mocked `fetch` and fake timers. Green: FR-01904
   (selection rules), FR-01906 (empty message), FR-01908 (each error code → pt-BR turn, retry),
   FR-01909 (30 s abort), FR-01911 (labels) tests.
4. Transcript and composer components with their stylesheet. Green: FR-01902, FR-01903,
   FR-01905, FR-01907, FR-01919, FR-01920, NFR-01904 component tests; `npm run lint` clean.
5. Preview modal for widget patches and dashboard proposals, with the Leitor state. Green:
   FR-01910, FR-01913, FR-01916, FR-01917, NFR-01902 tests; both panes snapshot-stable.
6. The tab composing the pieces, the collapse toggle, wired into `PropertyPanel`. Green:
   FR-01901, FR-01922 component tests; the existing 011 panel tests still pass.
7. Rail `IA` behaviour and the end-to-end file with axe. Green: FR-01921 and NFR-01901 pass
   in `npm run test:e2e`; the full flow chip → preview → apply → undo passes.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Rendering the "after" pane re-runs the engine for a 50-category widget inside a modal | NFR-01902 missed, modal feels slow | panes reuse the memoised chart data of the canvas for "before" and compute only "after"; measured in step 5 |
| A live region that re-renders announces the same answer twice | screen-reader noise, NFR-01904 | the live region's text node is keyed by turn id and only the latest turn is inside it |
| The rail is a server component in 001 and the `IA` entry needs client state | hydration mismatch or a client boundary on the whole rail | only the `IA` entry becomes a client island; the rest of `Rail.tsx` stays server-rendered |
| Retrying the last message after a 429 before `Retry-After` elapses | second 429 | the `Tentar novamente` button is enabled only after `Retry-After` seconds, shown in its label |
| A stale client applies a patch the server would now reject | invalid document, autosave 400 | the patch is parsed with `src/core/schema` on the client before `applyWidgetPatch` |
| `[analysisId]` route path not captured by the traceability planned-file regex | false "unrequested change" line | known landmine; explained once in the pull request body |

## Human approval required

None. This spec touches no authentication, authorisation, cryptography, migration or
deletion; the Leitor state re-uses the role already resolved by 010-studio-canvas.

## Verification

```
npm ci
docker compose up -d db && npm run db:migrate
LLM_PROVIDER=fake npm run lint && LLM_PROVIDER=fake npm test
npx vitest run src/ui/assistant src/ui/studio/store.test.ts
LLM_PROVIDER=fake npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/019-assistant-ui
```

A pass: every command exits 0; in the running app, with the fake provider scripted to
return `{ type: 'bar', top: 5, sort: 'desc', condition: 'budget', conditionColor: '#d44655' }`,
the first chip opens `Prévia da alteração sugerida` with the line
`Tipo: Barras horizontais · Limite: 5 · Ordem: Maior valor primeiro · Destaque: Acima da comparação · Cor: #d44655`,
`Aplicar alterações` changes every selected widget, one `Desfazer` restores all of them, and
the transcript reads `Alterações aplicadas a 2 componente(s). Você pode desfazer ou ajustar nas propriedades.`;
axe reports zero serious or critical violations on the tab and the modal; the matrix
shows every FR/NFR with at least one test.

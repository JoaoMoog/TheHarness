# Tasks: Measures and parameters UI

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | store actions for measures and parameters with caps, reserved names, duplicate and in-use refusals, single-selection binding, one snapshot per success | FR-01406, FR-01407, FR-01409, FR-01413, FR-01414, FR-01416, FR-01417, FR-01418, FR-01419, FR-01420, FR-01421, FR-01422, NFR-01403 | `src/ui/studio/store.ts`, `src/ui/studio/store.test.ts` | the listed ids in `store.test.ts`; refusal messages and history length asserted | - | | Q1 |
| T2 | formula preview hook and the measure form with suggestions, debounce, result line and disabled save | FR-01402, FR-01403, FR-01404, FR-01405, NFR-01401 | `src/ui/studio/measures/useFormulaPreview.ts`, `src/ui/studio/measures/useFormulaPreview.test.ts`, `src/ui/studio/measures/MeasureForm.tsx`, `src/ui/studio/measures/MeasureForm.test.tsx` | the listed ids in the two test files with fake timers | - | P | Q1 |
| T3 | parameters form, the `Medidas calculadas` dialog with list, `Editar`, `Excluir` and toasts, context bar wiring hidden for readers | FR-01401, FR-01408, FR-01410, FR-01415, FR-01423 | `src/ui/studio/measures/ParamsForm.tsx`, `src/ui/studio/measures/MeasuresDialog.tsx`, `src/ui/studio/measures/MeasuresDialog.test.tsx`, `src/ui/studio/ContextBar.tsx`, `src/ui/studio/measures/measures.module.css` | the listed ids in `MeasuresDialog.test.tsx` | T1, T2 | | Q1 |
| T4 | measure options in `Valor` and `Comparação`, widget error note on the card (engine error helper if step 1 found none) | FR-01411, FR-01412 | `src/ui/studio/panel/DadosTab.tsx`, `src/ui/studio/WidgetCard.tsx`, `src/ui/studio/panel/DadosTab.test.tsx`, `src/ui/studio/WidgetCard.test.tsx` | the listed ids in the two test files | T1 | P | Q1 |
| T5 | e2e: create, validate, apply, edit, remove, caps by fixture, division-by-zero widget, undo per action, reader session, axe, timings | NFR-01402, NFR-01404 | `tests/e2e/014-measures-and-parameters-ui.spec.ts` | `npm run test:e2e` green; traceability matrix complete | T3, T4 | | Q1 |

Nothing here is Q3 or Q4: removals are undoable document edits, and no manifest,
CI, migration, authentication or deletion of stored records is touched. T3 lists
five files because the stylesheet is a one-line sibling and the context bar change
is one handler.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no formula language change,
      no measure-to-measure references, no workspace parameters, measures in use
      cannot be removed, validation on the dashboard recorte, duplicate measure
      names allowed, and the four open questions with the assumptions the plan
      took for them.

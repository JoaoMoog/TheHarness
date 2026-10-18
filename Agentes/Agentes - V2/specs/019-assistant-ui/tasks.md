# Tasks: Assistant interface

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | store field `transcript`, the `panelTab` value `assistente`; actions `applyWidgetPatch`, `applyDashboardProposal`, `pushTurn`, clear on load, each with one history snapshot | FR-01912, FR-01914, FR-01915, FR-01918, FR-01923, NFR-01903 | `src/ui/studio/store.ts`, `src/ui/studio/store.test.ts` | FR-01912, FR-01914, FR-01915, FR-01918, FR-01923, NFR-01903 store tests | - | P | Q1 |
| T2 | label maps and the request hook: selection rules, empty message guard, 30 s abort, envelope → error turn, retry after `Retry-After` | FR-01904, FR-01906, FR-01908, FR-01909, FR-01911 | `src/ui/assistant/labels.ts`, `src/ui/assistant/useAssistant.ts`, `src/ui/assistant/useAssistant.test.tsx`, `src/ui/assistant/labels.test.ts` | FR-01904, FR-01906, FR-01908, FR-01909, FR-01911 tests with mocked `fetch` and fake timers | - | P | Q1 |
| T3 | transcript (empty state, live region, busy state, error turns) and composer (labelled form, chips, meta line) with the stylesheet | FR-01902, FR-01903, FR-01905, FR-01907, FR-01919, FR-01920, NFR-01904 | `src/ui/assistant/Transcript.tsx`, `src/ui/assistant/Composer.tsx`, `src/ui/assistant/assistant.module.css`, `src/ui/assistant/Transcript.test.tsx`, `src/ui/assistant/Composer.test.tsx` | FR-01902, FR-01903, FR-01905, FR-01907, FR-01919, FR-01920, NFR-01904 component tests | - | P | Q1 |
| T4 | preview modal for widget patches (two panes through the chart renderers) and dashboard proposals (value rows), `Cancelar` / `Aplicar alterações`, Leitor note | FR-01910, FR-01913, FR-01916, FR-01917, NFR-01902 | `src/ui/assistant/PreviewModal.tsx`, `src/ui/assistant/PreviewModal.test.tsx` | FR-01910, FR-01913, FR-01916, FR-01917 tests; NFR-01902 timing test with a 50-category widget | T1 | | Q1 |
| T5 | the tab composing transcript, composer and preview modal, the collapse toggle, wired as the `Assistente` tab of the property panel | FR-01901, FR-01922 | `src/ui/assistant/AssistantTab.tsx`, `src/ui/studio/panel/PropertyPanel.tsx`, `src/ui/assistant/AssistantTab.test.tsx` | FR-01901, FR-01922 component tests; 011 panel tests still green | T2, T3, T4 | | Q1 |
| T6 | rail `IA` entry behaviour and the end-to-end file with axe | FR-01921, NFR-01901 | `src/ui/shell/Rail.tsx`, `tests/e2e/019-assistant-ui.spec.ts` | FR-01921 and NFR-01901 in `npm run test:e2e`; chip → preview → apply → undo flow | T5 | | Q1 |

Nothing here is Q3 or Q4: no manifest, infrastructure, authentication, authorisation,
cryptography, migration or deletion is touched; the Leitor state reuses the role that
010-studio-canvas already resolves. Six tasks rather than five because the preview
modal and the tab wiring share no file and are each a full sitting of tests.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no transcript persistence, no home
      page routing, no streaming, no rendered panes for dashboard proposals, the four open
      questions and the assumptions the plan took for them.

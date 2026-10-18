# Tasks: Studio canvas

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | store with `commit` validation and read-only no-ops, page actions with the 20/100 limits, undo/redo history capped at 30, keyboard shortcuts | FR-01011, FR-01012, FR-01013, FR-01014, FR-01015, FR-01016, FR-01017, FR-01018, NFR-01002, NFR-01003 | `src/ui/studio/store.ts`, `src/ui/studio/history.ts`, `src/ui/studio/keyboard.ts`, `src/ui/studio/store.test.ts` | `npx vitest run src/ui/studio/store.test.ts` green, one `it` per id | - | | Q1 |
| T2 | server route with `requireUser`/`assertCan` and 404, provider in the shell layout, `Studio` client root with heading, filters, invalid-document and rows-error states | FR-01001, FR-01002, FR-01003, FR-01028 | `src/app/(shell)/dashboard/[analysisId]/page.tsx`, `src/app/(shell)/layout.tsx`, `src/ui/studio/StudioProvider.tsx`, `src/ui/studio/Studio.tsx`, `src/ui/studio/studio.module.css` | jsdom test of `Studio` finds heading and selects; `npm run build` passes; FR-01001/FR-01002/FR-01003 e2e in T7 | T1 | | Q2 |
| T3 | canvas grid, widget cards through `rendererFor` with engine chart data, indicator strip, breakpoints | FR-01004, FR-01005, FR-01006, FR-01007, FR-01010, FR-01022, FR-01026 | `src/ui/studio/Canvas.tsx`, `src/ui/studio/WidgetCard.tsx`, `src/ui/studio/KpiStrip.tsx`, `src/ui/studio/Canvas.test.tsx`, `src/ui/studio/canvas.module.css` | `npx vitest run src/ui/studio/Canvas.test.tsx` green | T2 | | Q1 |
| T4 | page bar, `Configurar página` dialog, context bar | FR-01008, FR-01009 | `src/ui/studio/PageBar.tsx`, `src/ui/studio/PageDialog.tsx`, `src/ui/studio/ContextBar.tsx`, `src/ui/studio/PageBar.test.tsx` | `npx vitest run src/ui/studio/PageBar.test.tsx` green, including DOM-level checks of FR-01011 … FR-01016 | T2 | P | Q1 |
| T5 | autosave subscriber with debounce, revision and 409/5xx mapping; header islands for undo/redo and the save indicator | FR-01019, FR-01020, FR-01021, NFR-01004 | `src/ui/studio/autosave.ts`, `src/ui/studio/HeaderIslands.tsx`, `src/ui/shell/Header.tsx`, `src/ui/studio/autosave.test.ts` | `npx vitest run src/ui/studio/autosave.test.ts` green with fake timers and fake `fetch` | T2 | P | Q2 |
| T6 | explorer content and islands (page tree, workspace search), footer source line | FR-01023, FR-01024, FR-01025 | `src/ui/shell/Explorer.tsx`, `src/ui/studio/ExplorerIslands.tsx`, `src/ui/shell/Footer.tsx`, `src/ui/studio/ExplorerIslands.test.tsx` | `npx vitest run src/ui/studio/ExplorerIslands.test.tsx` green | T2 | P | Q1 |
| T7 | panel header island, read-only sweep, e2e with axe, paint timing and the two-context conflict flow | FR-01027, NFR-01001, NFR-01005 | `src/ui/shell/PropertyPanel.tsx`, `src/ui/studio/PanelHeader.tsx`, `tests/e2e/010-studio-canvas.spec.ts` | `npm run test:e2e` green; axe zero serious/critical; 100-widget paint under 1 s | T3, T4, T5, T6 | | Q1 |

Seven tasks rather than six because this spec modifies four chrome files from
001 (header, explorer, footer, property panel) and each must stay in a task of
at most four files. T2 and T5 are Q2 because they call the existing
`requireUser`/`assertCan` and the protected document write without adding any
rule: run, then a human reviews the diff before merge. Nothing here is Q4.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no widget editing, no
      drag/resize, no filter editing or click interactions, the toolbar
      buttons still do nothing, the property panel body is still the
      placeholder, no automatic conflict resolution, the four open questions
      and the assumptions the plan took for them.

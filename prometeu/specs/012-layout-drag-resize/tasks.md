# Tasks: Layout drag and resize

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | store actions `reorderWidget`, `moveWidget`, `resizeWidget`, `setSpanForSelection` with no-op detection and one snapshot per call | FR-01203, FR-01206, FR-01211, FR-01214, FR-01216, FR-01217, FR-01219, FR-01222, FR-01224, NFR-01204 | `src/ui/studio/store.ts`, `src/ui/studio/store.test.ts` | the listed ids in `store.test.ts`; history length asserted | - | | Q1 |
| T2 | resize gesture: pure maths, pointer capture with CSS-custom-property preview, commit on release, arrow keys; grip component mounted in the card | FR-01201, FR-01207, FR-01208, FR-01209, FR-01210, FR-01212, FR-01213 | `src/ui/studio/layout/useResizeGesture.ts`, `src/ui/studio/layout/useResizeGesture.test.ts`, `src/ui/studio/layout/ResizeGrip.tsx`, `src/ui/studio/WidgetCard.tsx` | the listed ids in `useResizeGesture.test.ts` with a fixed 1200 px canvas | T1 | | Q1 |
| T3 | reorder gesture: drag handle, drop-target state, drop splice, Escape and outside-drop cancel, toast | FR-01202, FR-01204, FR-01205 | `src/ui/studio/layout/useDragReorder.ts`, `src/ui/studio/layout/useDragReorder.test.tsx`, `src/ui/studio/layout/DragHandle.tsx`, `src/ui/studio/Canvas.tsx` | the listed ids in `useDragReorder.test.tsx` dispatching `DragEvent`s | T2 | | Q1 |
| T4 | Organizar menu in the toolbar, live-region announcer, reader-mode hiding, stylesheet with hit areas and breakpoints | FR-01215, FR-01218, FR-01220, FR-01223, NFR-01203 | `src/ui/studio/layout/OrganizarMenu.tsx`, `src/ui/studio/layout/OrganizarMenu.test.tsx`, `src/ui/studio/layout/LayoutAnnouncer.tsx`, `src/ui/shell/Toolbar.tsx`, `src/ui/studio/layout/layout.module.css` | the listed ids in `OrganizarMenu.test.tsx`; announcer text asserted | T3 | | Q1 |
| T5 | e2e: real drag and drop, snapping resize, keyboard resize, undo per gesture, panel sync, announcements, reader session, axe, timing budgets | FR-01221, NFR-01201, NFR-01202, NFR-01205 | `tests/e2e/012-layout-drag-resize.spec.ts` | `npm run test:e2e` green; traceability matrix complete | T4 | | Q1 |

Nothing here is Q3 or Q4: no manifest, CI, migration, authentication or deletion
is touched. T2 lists four files because the card must mount the grip for the hook
test to be meaningful; T4 lists five because the stylesheet is a one-line sibling
of the components it styles.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no free positioning, no
      cross-page drag, no touch reorder (hidden below 760 px), the four Organizar
      commands as assumed, move commands acting on the primary selection only, and
      the three open questions with the assumptions the plan took for them.

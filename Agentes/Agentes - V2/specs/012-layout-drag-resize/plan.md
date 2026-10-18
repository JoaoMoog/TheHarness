# Implementation plan: Layout drag and resize

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: the Organizar menu carries exactly the four commands `Mover para antes`,
`Mover para depois`, `Largura total` and `Metade`; below 760 px and for touch
pointers the handle and grip are hidden (no touch reorder); with a multi-selection
the move commands act on the primary selected widget only while the width commands
act on every selected widget. A different answer changes steps 4 and 5 only.

## Approach

Keep the prototype's two mechanisms — HTML5 drag-and-drop for reorder and pointer
capture for resize — as two hooks that own the gesture state locally and call one
store action once, at the end of the gesture, so the store's history sees a single
snapshot per gesture. The live preview is CSS custom properties (`--span`,
`--card-height`) set on the card element during the gesture, never store state, which
keeps the 100-widget canvas from re-rendering on every pointer move. Rejected: a
grid library (react-grid-layout or dnd-kit) — it would replace the flow layout with
absolute positioning, breaking the prototype's stacked breakpoints and the server
rendered export; the two hooks are under 150 lines together. Rejected: writing every
pointer move into the store and coalescing history — it makes the undo cap
depend on a debounce and would autosave intermediate frames.

## Reuse found

- `src/ui/studio/store.ts` (planned in 010-studio-canvas): the zustand store with
  `document`, `activePage`, `selection` and the whole-document history; every
  mutation goes through a store action that pushes one snapshot. This plan adds
  four actions there and reuses the snapshot mechanism unchanged.
- `src/ui/studio/WidgetCard.tsx` and `src/ui/studio/Canvas.tsx` (planned in
  010-studio-canvas): the card renders `--span` and `--card-height` from the widget;
  this plan adds the handle and grip slots and the drop-target class.
- `src/ui/studio/panel/AparenciaTab.tsx` (planned in 011-widget-editing): the
  Largura and Altura controls bound to the store, which pick up committed values
  with no change (FR-01221 is a test, not code).
- `src/ui/shell/Toolbar.tsx` (planned in 001-app-skeleton, wired by
  011-widget-editing): the `Organizar` button exists and does nothing; this plan
  turns it into a menu button.
- `src/ui/shell/ToastProvider.tsx` (planned in 001-app-skeleton): `useToast().show`
  for `Ordem atualizada.`.
- `src/core/schema/widget.ts` and `src/core/schema/limits.ts` (planned in
  002-domain-schema): the span 3..12 and height 180..800 bounds are read from the
  limits module, never restated.
- Genuinely new: the reorder and resize hooks, the handle, grip and menu
  components, the live-region announcer and the e2e file.

## Files

| File | Change |
|---|---|
| `src/ui/studio/store.ts` | modified: actions `reorderWidget(widgetId, toIndex)`, `moveWidget(widgetId, delta)`, `resizeWidget(widgetId, size)`, `setSpanForSelection(span)`; each pushes one history snapshot and is a no-op (no snapshot) when nothing changes |
| `src/ui/studio/store.test.ts` | modified: tests for the four actions, no-op cases, single snapshot per call |
| `src/ui/studio/layout/useDragReorder.ts` | created: dragstart/dragover/drop/dragend/Escape handling, drop-target id state, calls `reorderWidget` once |
| `src/ui/studio/layout/useResizeGesture.ts` | created: pointer capture, span/height maths with `canvasWidth / 12` and the 10 px step, CSS custom-property preview, commit on pointerup/pointercancel, arrow-key handler |
| `src/ui/studio/layout/DragHandle.tsx`, `ResizeGrip.tsx` | created: `⠿` and `⌟` buttons with accessible names, hidden for readers and below 760 px |
| `src/ui/studio/layout/OrganizarMenu.tsx` | created: menu button with the four commands, disabled state and the empty-selection text |
| `src/ui/studio/layout/LayoutAnnouncer.tsx` | created: polite `aria-live` region and `announce(text)` context |
| `src/ui/studio/layout/layout.module.css` | created: handle, grip, `.dropTarget`, focus ring, hit areas, breakpoint hiding |
| `src/ui/studio/layout/useResizeGesture.test.ts`, `useDragReorder.test.tsx`, `OrganizarMenu.test.tsx` | created: unit tests named by requirement id |
| `src/ui/studio/WidgetCard.tsx` | modified: render `DragHandle` and `ResizeGrip` for editors, apply `.dropTarget`, expose the card element to the resize hook |
| `src/ui/studio/Canvas.tsx` | modified: mount `useDragReorder` and `LayoutAnnouncer`, pass the canvas width to the resize hook |
| `src/ui/shell/Toolbar.tsx` | modified: `Organizar` renders `OrganizarMenu` on the dashboard route |
| `tests/e2e/012-layout-drag-resize.spec.ts` | created: drag preview and drop, Escape, resize snapping, keyboard resize, Organizar, announcements, reader mode, axe, timing |

## Contracts

- Store actions (all synchronous, all push at most one history snapshot):
  `reorderWidget(widgetId: string, toIndex: number)`, `moveWidget(widgetId: string, delta: -1 | 1)`,
  `resizeWidget(widgetId: string, size: { span: number; height: number })`,
  `setSpanForSelection(span: 6 | 12)`. Each validates the resulting widget with the
  002-domain-schema widget schema before committing and throws on failure (a
  programming error, never reachable through the UI because the hooks clamp first).
- Resize maths, pure and unit-tested: `nextSpan(startSpan, dx, canvasWidth)` =
  clamp(startSpan + round(dx / (canvasWidth / 12)), 3, 12);
  `nextHeight(startHeight, dy)` = clamp(round((startHeight + dy) / 10) × 10, 180, 800).
- Live preview: the card element carries `--span` and `--card-height`; the canvas
  grid reads them. During a gesture the hook writes them directly; after commit the
  render writes the same values from the store.
- Announcer: `announce(text: string)` writes into one `aria-live="polite"` region
  rendered once per canvas; strings `<título> movido para a posição <n> de <total>`
  and `<título>: largura <span> de 12, altura <height> px`.
- No HTTP contract changes; the document PUT from 010-studio-canvas carries the
  new span, height and page order as before.

## Order of work

1. Confirm the reused files exist as described (store with history snapshots,
   `WidgetCard`, `Canvas`, `AparenciaTab` width/height controls, `Toolbar` with the
   `Organizar` button, `ToastProvider`, limits module); if not, return blocked.
   Green: the existing 010 and 011 suites pass untouched.
2. Store actions and their tests, including the no-op cases and the
   one-snapshot-per-call assertion. Green: `npx vitest run src/ui/studio/store.test.ts`.
3. Pure resize maths and the resize hook with the CSS-custom-property preview,
   pointer commit and arrow keys; `ResizeGrip` mounted in `WidgetCard`. Green:
   `useResizeGesture.test.ts` covers FR-01207..FR-01214 and NFR-01204.
4. Reorder hook with drop-target state, Escape and outside-drop handling;
   `DragHandle` mounted; `Canvas` wiring; toast. Green: `useDragReorder.test.tsx`
   covers FR-01202..FR-01206.
5. `OrganizarMenu` in the toolbar, announcer, reader-mode hiding, breakpoint CSS.
   Green: `OrganizarMenu.test.tsx` covers FR-01215..FR-01220, FR-01223.
6. e2e: real drag with the Playwright mouse, resize snapping at a known canvas
   width, keyboard resize, undo after each gesture, announcements, reader session,
   axe and the timing budgets. Green: `npm run test:e2e` and the traceability
   command report every id.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| HTML5 drag events fire `dragover` many times per second and `dragend` after `drop`; a stale drop-target class can survive | ghost highlight | one `dropTargetId` state cleared on `drop`, `dragend` and Escape; e2e asserts zero `.dropTarget` after each gesture |
| `setPointerCapture` on the grip means the card is not the event target; reading the card width from the grip's parent breaks if 010 nests the grip differently | wrong `unit` and jumpy snapping | the hook takes the canvas width from `Canvas` through a ref, not from DOM traversal; unit test feeds a fixed width |
| 010's store may push a snapshot on every action call even when nothing changed, defeating FR-01211 and FR-01214 | history fills with no-ops | the four actions compare before writing and return early; the store test asserts history length |
| Playwright drag-and-drop with native HTML5 events is unreliable in Chromium headless | flaky e2e | e2e uses `page.dragAndDrop` with explicit `dragover` steps and falls back to dispatching `DragEvent` with a `DataTransfer`; the unit test covers the logic, e2e covers the visible outcome |
| Route-group paths are not captured by the traceability planned-file regex | false "unrequested change" lines | known landmine in `_context.md`; no route file is touched here, so none expected |

## Human approval required

None. No authentication, authorisation, cryptography, migration or deletion is
touched; readers are excluded by rendering, and the server-side check on the
document PUT is owned by 010-studio-canvas.

## Verification

```
npm ci
npm run lint && npm test
npx vitest run src/ui/studio
npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/012-layout-drag-resize
```

Observable: open an analysis as an Editor, drag a card by `⠿` over another card
(it highlights), drop it (order changes, toast `Ordem atualizada.`), press Ctrl+Z
(order returns). Drag `⌟` on a 1200 px canvas by 100 px right and 33 px down: the
card snaps to span +1 and height +30. Tab to `⌟`, press ArrowRight twice: span +2,
two undo steps. Open `Organizar` with nothing selected: every command disabled.
Sign in as a Leitor: no handles, grips or menu. A pass: every command exits 0, the
matrix shows every FR/NFR with at least one test, and the history length grows by
exactly one per gesture.

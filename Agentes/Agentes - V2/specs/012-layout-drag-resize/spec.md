# Specification: Layout drag and resize

Status: draft
Owner: João Moog

## Problem

After 011-widget-editing an Editor can change a widget's width and height only by
typing numbers into the property panel, and cannot change the order of widgets on a
page at all. The prototype lets the Editor drag a card by its ⠿ handle to reorder,
drag the ⌟ corner to resize with snapping, and use the arrow keys on the focused
corner; none of that exists in the rewrite yet. The prototype's "Organizar" toolbar
button only opens the property panel with a hint toast, and it has no keyboard or
assistive-technology equivalent for reordering, so a keyboard-only Editor is worse
off than a mouse user. Each gesture must produce exactly one undo entry and one
autosave, or the 30-entry history fills with intermediate frames of a single drag.

## Goal

An Editor reorders and resizes widgets on the canvas by pointer or keyboard, sees a
live preview while the gesture runs, hears the result through a live region, and can
undo each gesture as a single step.

## Out of scope

- Free positioning on a pixel grid or dragging between pages. Widgets keep the
  prototype's flow layout: a page is an ordered list, each widget has a column span
  and a height.
- Editing span and height through the property panel controls (defined in
  011-widget-editing; this spec only keeps them in sync).
- Dragging fields into the Dados selectors (defined in 011-widget-editing).
- Multi-selection semantics beyond what the Organizar commands state below.
- Touch and stacked layouts narrower than 760 px (open question below).

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-01201 | State | WHILE the current user is an Editor or Administrador and the canvas is not in presentation mode, every widget card on the active page SHALL render a drag handle with the glyph `⠿` and accessible name `Arrastar <título>`, and a resize grip with the glyph `⌟` and accessible name `Redimensionar <título>`, both reachable by Tab. |
| FR-01202 | Event | WHEN an Editor drags a handle over another card of the same page, the card under the pointer SHALL be marked as the drop target, and at most one card SHALL carry that mark at any time. |
| FR-01203 | Event | WHEN an Editor drops a dragged widget on another card of the same page, the page order SHALL become the previous order with the dragged widget removed and reinserted at the target card's index, the other widgets keeping their relative order, and the toast `Ordem atualizada.` SHALL be shown. |
| FR-01204 | Event | WHEN the Escape key is pressed while a drag is in progress, the drag SHALL end with the page order unchanged, the drop-target mark removed and no history entry added. |
| FR-01205 | Unwanted | IF a dragged widget is dropped outside every card of the active page (on the toolbar, a page tab, the property panel or the canvas gap), THEN the page order SHALL stay unchanged, no toast SHALL be shown and the drop-target mark SHALL be removed. |
| FR-01206 | Unwanted | IF a dragged widget is dropped on itself, THEN the page order SHALL stay unchanged and no history entry SHALL be added. |
| FR-01207 | Event | WHEN a pointer resize starts on a grip and the pointer moves by `dx` horizontally, the previewed span SHALL be the starting span plus `dx` divided by one twelfth of the canvas width, rounded to the nearest integer, and clamped to the range 3..12. |
| FR-01208 | Event | WHEN a pointer resize starts on a grip and the pointer moves by `dy` vertically, the previewed height SHALL be the starting height plus `dy`, rounded to the nearest multiple of 10 px, and clamped to the range 180..800 px. |
| FR-01209 | State | WHILE a pointer resize is in progress, the card SHALL show the previewed span and height on the canvas without any change to the document, the history or the save state. |
| FR-01210 | Event | WHEN the pointer is released or the pointer capture is cancelled at the end of a resize, the widget's span and height SHALL be committed to the document once, with the previewed values, producing exactly one history entry and one autosave. |
| FR-01211 | Unwanted | IF a pointer resize ends with the same span and height it started with, THEN no history entry SHALL be added and the document SHALL not be marked dirty. |
| FR-01212 | Event | WHEN a resize grip has keyboard focus and ArrowRight or ArrowLeft is pressed, the widget's span SHALL change by +1 or −1 within 3..12, the change SHALL be committed as one history entry, and focus SHALL remain on the same grip. |
| FR-01213 | Event | WHEN a resize grip has keyboard focus and ArrowDown or ArrowUp is pressed, the widget's height SHALL change by +20 or −20 px within 180..800, the change SHALL be committed as one history entry, and focus SHALL remain on the same grip. |
| FR-01214 | Unwanted | IF an arrow key would move the span or height beyond its bound (span 3 or 12, height 180 or 800), THEN the value SHALL stay at the bound and no history entry SHALL be added. |
| FR-01215 | Event | WHEN an Editor activates the toolbar button `Organizar`, a menu SHALL open with the commands `Mover para antes`, `Mover para depois`, `Largura total` and `Metade`, each operable by keyboard. |
| FR-01216 | Event | WHEN `Mover para antes` or `Mover para depois` is chosen, the selected widget SHALL swap places with its predecessor or successor in the page order, and the toast `Ordem atualizada.` SHALL be shown. |
| FR-01217 | Event | WHEN `Largura total` or `Metade` is chosen, every selected widget's span SHALL become 12 or 6 respectively, committed as one history entry for the whole selection. |
| FR-01218 | Unwanted | IF no widget is selected when the Organizar menu opens, THEN every command SHALL be disabled and the menu SHALL show the text `Adicione ou selecione um componente.`. |
| FR-01219 | Unwanted | IF `Mover para antes` is chosen for the first widget of the page or `Mover para depois` for the last, THEN the order SHALL stay unchanged and no history entry SHALL be added. |
| FR-01220 | Event | WHEN a reorder commits, a polite live region SHALL announce `<título> movido para a posição <n> de <total>`; WHEN a resize commits, it SHALL announce `<título>: largura <span> de 12, altura <height> px`. |
| FR-01221 | Event | WHEN any gesture of this specification commits, the property panel's width and height controls for the selected widget SHALL show the committed values without a page reload. |
| FR-01222 | Event | WHEN undo is invoked after a gesture of this specification, the page order, span and height SHALL return to their values before that single gesture. |
| FR-01223 | State | WHILE the current user is a Leitor, the canvas SHALL render no drag handle, no resize grip and no `Organizar` menu, and no gesture on a card SHALL change the document. |
| FR-01224 | Ubiquitous | Every span committed by this specification SHALL be an integer in 3..12 and every height an integer multiple of 10 in 180..800, so that the committed document passes the document validation defined in 002-domain-schema without correction. |
| NFR-01201 | Ubiquitous | During a pointer resize on a page of 20 widgets, the interval between a pointer move and the repainted preview SHALL be at most 16 ms at p95, measured in the e2e runner. |
| NFR-01202 | Ubiquitous | A drop that reorders a page of 100 widgets SHALL repaint the canvas within 100 ms of the drop event. |
| NFR-01203 | Ubiquitous | The drag handle and the resize grip SHALL each have a hit area of at least 24 × 24 px and a visible focus ring of at least 2 px. |
| NFR-01204 | Ubiquitous | One gesture (drag-and-drop, pointer resize, one arrow key press, one Organizar command) SHALL add exactly 1 entry to the undo history and trigger exactly 1 autosave request. |
| NFR-01205 | Ubiquitous | An automated accessibility scan of the canvas with handles, grips and the open Organizar menu SHALL report zero violations of impact `serious` or `critical`. |

## Open questions

`[NEEDS CLARIFICATION: the Organizar command set — the prototype's Organizar only opens the property panel with the toast "Arraste pelo ícone ⠿ ou use Tamanho e bordas para ajustar e reposicionar." and exposes Mover para antes/depois elsewhere; the four commands above are a proposal, and adding "Alinhar alturas" or "Mover para o início/fim" changes the menu and the store actions.]`

`[NEEDS CLARIFICATION: touch and viewports of 760 px or narrower — the prototype stacks widgets there and its HTML5 drag does not work on touch; either the handle and grip are hidden below 760 px and on touch pointers, or a pointer-events reorder replaces HTML5 drag, which is a different implementation.]`

`[NEEDS CLARIFICATION: with a multi-selection, do Mover para antes/depois move only the primary selected widget (assumed) or the whole selection as a block? A block move changes the reorder action's contract.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/012-layout-drag-resize
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

# Implementation plan: Widget editing

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: no confirmation before delete (the toast offers `Desfazer`), the
broadcast list is exactly the prototype's twenty keys, the image limit is
1 MB on the file plus the schema's cap on the encoded string, and the title
limit is 150 everywhere (field `maxlength`, inline edit and schema). A
different answer changes the marked steps only.

## Approach

Add the widget actions to the 010 store behind its `commit`, so every panel
control, inline edit, duplicate, remove and image pick becomes one validated
document transition, and build the panel as three tab components over a small
set of bound controls whose ranges and options are read from the 002 schema
constants (never typed twice). Multi-selection broadcast is a pure function
from `(key, selection)` to the target ids, tested on its own. Text, button and
image widgets are three small components the card picks when `rendererFor`
returns `undefined`. Rejected: a generic form generated from the zod schema —
the prototype's panel groups, orders and labels controls by hand and hides
whole sections by type, which a generated form would need as much
configuration to reproduce as writing the three tabs. Rejected: contentEditable
for the panel's text fields — only the card's inline edit needs it; the panel
uses ordinary inputs.

## Reuse found

- `src/ui/studio/store.ts`, `history.ts`, `StudioProvider.tsx`, `WidgetCard.tsx`,
  `Canvas.tsx`, `PanelHeader.tsx` (planned in 010-studio-canvas): the store's
  `commit`, `select(id, { add })`, the card, and the panel header this spec
  replaces.
- `src/ui/shell/PropertyPanel.tsx`, `Toolbar.tsx`, `Modal.tsx`, `Toast.tsx`
  (planned in 001-app-skeleton): the chrome this spec wires; `useToast().show`.
- `src/core/schema` (planned in 002-domain-schema): `widgetSchema`,
  `widgetDefaults`, the enums for `type`, `dimension`, `aggregation`, `sort`,
  `unit`, `format`, `font`, `condition`, `interaction`, `imageFit`, `columns`,
  the numeric ranges (`span` 3–12, `height` 180–800, `fontSize` 10–22,
  `titleSize` 12–30, `padding` 0–36, `radius` 0–24, `border` 0–4, `decimals`
  0–4, `top` 0–50), `MAX_TITLE = 150`, `MAX_SUBTITLE = 200`, `MAX_TEXT = 4000`,
  `MAX_WIDGETS = 100`, the image data-URL rule, and the document-internal id
  generator. Assumed exported as named constants; if only embedded in the zod
  chain, step 2 reads them with `.minValue`/`.maxValue` and nothing else changes.
- `src/ui/charts` (planned in 009-svg-charts): `rendererFor(type)` returning
  `undefined` for text, image, button and filter.
- Prototype values, not code: `dist/editor-pro.js` `paintProperties`, `pSelect`,
  `pInput`, `pToggle`, `updateWidget` (broadcast list), `addProWidget`
  (insertion overrides), `duplicateWidget`, `insertProDialog`, `imageDialog`,
  the `input`/`change`/`dblclick`/`focusout`/`keydown`/`drop` listeners and
  every pt-BR string; `dist/editor-pro.css` `.pro-section`, `.pro-field`,
  `.pro-check`, `.pro-two`, `.pro-column-checks`, `.pro-fields-palette`,
  `.editing`, `.pro-text`, `.pro-image-upload`.

Genuinely new: the widget actions, the binding and broadcast logic, the three
tabs and their controls, the insert dialog, the toolbar island, inline editing,
the text/button/image widgets and the image dialog.

## Files

| File | Change |
|---|---|
| `src/ui/studio/store.ts` | modified: actions `addWidget`, `updateWidgets`, `duplicateWidget`, `removeWidgets`, `moveWidget`, `setImage`, `panelTab`; all through `commit` |
| `src/ui/studio/panel/binding.ts` | created: `BROADCAST_KEYS`, `targetsFor(key, selection)`, `controlSpec(key)` from schema constants, range/option check returning the pt-BR message |
| `src/ui/studio/insertDefaults.ts` | created: type labels (`Colunas agrupadas` … `Filtro`), dimension and value-name labels, per-type overrides for title, dimension, span, height |
| `src/ui/studio/editing.test.ts` | created: FR-01102, FR-01103, FR-01113, FR-01116, FR-01117, FR-01118 at store level; NFR-01101 seeded property test; NFR-01105 coalescing |
| `src/ui/studio/panel/PropertyPanel.tsx` | created: title, tabs, empty text, multi-selection note, read-only mode, tab routing |
| `src/ui/studio/panel/controls.tsx` | created: `Section`, `SelectField`, `NumberField` (inline range message), `TextField` (live update, commit on blur), `ColorField`, `Toggle`, all bound through `binding.ts` |
| `src/ui/studio/panel/controls.test.tsx` | created: FR-01104, FR-01113, FR-01114, FR-01123 (panel side), NFR-01102 |
| `src/ui/studio/panel/panel.module.css` | created: ported section, field, check, two-column and palette rules |
| `src/ui/shell/PropertyPanel.tsx` | modified: mounts `panel/PropertyPanel` instead of `PanelHeader` |
| `src/ui/studio/PanelHeader.tsx` | deleted: absorbed by `panel/PropertyPanel.tsx` |
| `src/ui/studio/panel/DataTab.tsx` | created: Campos, selects, Ordenação e limite, the non-data message |
| `src/ui/studio/panel/FieldChips.tsx` | created: draggable chips, drop targets on selects, compatibility toast |
| `src/ui/studio/panel/DataTab.test.tsx` | created: FR-01105, FR-01106, FR-01107 |
| `src/ui/studio/panel/AppearanceTab.tsx` | created: Componente, Aparência, Números e gráfico (with table columns), Tamanho e bordas, Duplicar/Remover |
| `src/ui/studio/panel/InteractionsTab.tsx` | created: Ao clicar em um dado, Atalhos |
| `src/ui/studio/panel/tabs.test.tsx` | created: FR-01108 … FR-01112 |
| `src/ui/studio/InsertDialog.tsx` | created: `Adicionar componente` over `Modal`, twelve options, limit refusal |
| `src/ui/studio/ToolbarActions.tsx` | created: island wiring Inserir, Gráfico (opens panel on Aparência, focuses `Tipo`), Texto, Propriedades |
| `src/ui/shell/Toolbar.tsx` | modified: mounts `ToolbarActions`; the other buttons stay inert |
| `src/ui/studio/InsertDialog.test.tsx` | created: FR-01101, FR-01102 (DOM), FR-01103 (DOM) |
| `src/ui/studio/WidgetCard.tsx` | modified: Ctrl/Cmd + click, `⧉` button, inline edit hooks, body picks text/button/image/filter placeholder when `rendererFor` is `undefined`, read-only |
| `src/ui/studio/InlineEdit.tsx` | created: contentEditable title/body with Enter, Escape, blur, truncation, `Sem título` |
| `src/ui/studio/widgets/TextWidget.tsx`, `src/ui/studio/widgets/ButtonWidget.tsx` | created: body with placeholder; label with `Abrir página` (no navigation) |
| `src/ui/studio/WidgetCard.test.tsx` | created: FR-01115, FR-01117 (card button), FR-01119, FR-01120, FR-01123 (card side) |
| `src/ui/studio/widgets/ImageWidget.tsx` | created: `Escolher uma imagem` button or `<img>` with `object-fit` and alt |
| `src/ui/studio/widgets/ImageDialog.tsx` | created: `Inserir imagem` over `Modal`, type/size check, `FileReader` to data URL, error line with `role="status"` |
| `src/ui/studio/widgets/ImageDialog.test.tsx` | created: FR-01121, FR-01122, NFR-01103 |
| `tests/e2e/011-widget-editing.spec.ts` | created: insert → configure → duplicate → inline edit → remove → undo as Editor; Leitor sweep; axe per type (NFR-01104) |

## Contracts

- Store actions (all refuse with `{ ok: false, reason: "read_only" }` for a
  Leitor): `addWidget(type) → { ok: true, id } | { ok: false, reason: "limit" }`;
  `updateWidgets(ids, patch) → { ok: true } | { ok: false, field, message }`
  where `patch` is a partial widget validated by `widgetSchema.partial()` before
  `commit`; `duplicateWidget(id)`; `removeWidgets(ids)`; `moveWidget(id, -1 | 1)`;
  `setImage(id, dataUrl)`; `panelTab: "data" | "appearance" | "interactions"`.
- `BROADCAST_KEYS` (exported, tested): `color`, `comparisonColor`, `background`,
  `textColor`, `borderColor`, `font`, `fontSize`, `titleSize`, `padding`,
  `radius`, `border`, `height`, `span`, `legend`, `labels`, `axes`, `grid`,
  `unit`, `decimals`, `format`. `targetsFor(key, selection)` returns the whole
  selection for these and `[selection[0]]` otherwise.
- `controlSpec(key)` → `{ kind, options?, min?, max?, step?, maxLength? }`
  derived from the schema constants; the inline message is `Informe um valor
  entre <min> e <max>.` for numbers and `Escolha uma das opções.` for selects.
- Inline edit markup: `data-inline="title" | "text"` on the editable element,
  matching the prototype so 019's preview and 017's export can strip it.
- Image dialog: accepts `image/png`, `image/jpeg`, `image/webp`, `size ≤
  1_048_576` bytes; produces a `data:image/<type>;base64,` URL validated by the
  schema's image rule before `setImage`.
- Nothing HTTP: writes reach the server only through 010's autosave. Nothing
  breaking: `WidgetCard` and `store` gain actions and props; 010's tests keep
  passing.

## Order of work

1. Confirm the reused files exist as described (010 store with `commit` and
   `select`, `WidgetCard`, `PanelHeader`; 001 `PropertyPanel`, `Toolbar`,
   `Modal`, toast; 002 schema constants and enums; 009 `rendererFor`); if not,
   return blocked. Green: `npm run lint && npm test` on the untouched tree.
2. Store actions, `binding.ts`, `insertDefaults.ts` with the property test
   (schema constants source: marked assumption). Green: `editing.test.ts`
   passes, including 1 000 random sequences with 0 invalid documents.
3. Panel frame, bound controls, shell mount, stylesheet; `PanelHeader` removed.
   Green: `controls.test.tsx` passes; 010's tests still pass with the new mount.
4. Dados tab and field chips. Green: `DataTab.test.tsx` passes, including the
   incompatible-drop toast.
5. Aparência and Interações tabs. Green: `tabs.test.tsx` passes, including the
   last-column rule and the `Escolher imagem` button presence.
6. Insert dialog, toolbar island and toolbar mount. Green: `InsertDialog.test.tsx`
   passes; `npm run build` passes.
7. Card editing: modifier click, `⧉`, inline edit, text and button widgets.
   Green: `WidgetCard.test.tsx` passes, including Escape restoring the value.
8. Image widget and dialog (limit basis: marked assumption), then the e2e with
   the Leitor sweep and axe per type. Green: `ImageDialog.test.tsx` and
   `npm run test:e2e` pass; traceability shows every id.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Control ranges typed in the UI drift from the schema | a value the UI accepts is refused by the API with 400, or vice versa | `controlSpec` reads the schema constants; a test asserts every numeric control's `min`/`max` equals the schema's for that key |
| Live typing in `Título` creates one undo entry per keystroke, as the prototype did | undo becomes useless after a rename | the card updates live from local state; the store `commit` happens on blur/Enter only (NFR-01105 test) |
| HTML5 drag and drop of chips is not keyboard accessible | NFR-01104 fails for chips | chips are decorative accelerators; every value is also selectable from the list, and the chips are `aria-hidden` for the scan with the selects carrying the accessible names |
| Broadcasting `span`/`height` to many widgets triggers a full canvas repaint | NFR-01102 breached on 100 widgets | `updateWidgets` writes once per commit; cards subscribe to their own widget by id, so only the changed ones re-render |
| `FileReader` result for a 1 MB WebP exceeds the schema's data-URL cap | image accepted by the dialog, refused by the schema | the dialog validates the encoded string with the schema rule before `setImage` and shows the same `Escolha PNG, JPEG ou WebP de até 1 MB.` message; the open question decides whether the cap or the dialog text moves |
| Removing `PanelHeader` breaks 010's tests | red tree mid-spec | step 3 updates the mount and runs 010's suite before moving on |
| A filter widget can be inserted but has no behaviour until 013 | a dead card on the canvas | the placeholder card shows the type label `Filtro` and nothing else; 013 replaces it |

## Human approval required

None. No authentication, authorisation, cryptography, schema migration or
data deletion: widget removal is an in-memory document edit that autosave
persists and `Desfazer` reverts.

## Verification

```
npm ci
docker compose up -d db && npm run db:migrate
npm run lint && npm test && npm run build
npm run dev            # open the demo analysis as an Editor, then as a Leitor
npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/011-widget-editing
```

A pass: every command exits 0; in the browser Inserir shows the twelve options
and `Indicador` lands as a 3-column, 200 px card titled `Indicador` with the
toast `Componente adicionado.`; typing 99 in `Largura (3–12 colunas)` shows the
range message and changes nothing; Ctrl-clicking two cards and picking a
`Fundo` colour recolours both while a `Título` change touches one; double-click
on a title, Escape, leaves it unchanged; a 2 MB PNG is refused with `Escolha
PNG, JPEG ou WebP de até 1 MB.` and a 300 KB one appears with `Imagem
adicionada.`; as a Leitor the panel shows values with no editable control and
the network panel shows no `PUT`; the matrix shows every FR/NFR with at least
one test.

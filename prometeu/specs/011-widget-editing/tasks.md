# Tasks: Widget editing

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | store widget actions through `commit`, broadcast and control-spec binding from schema constants, insertion defaults and labels, seeded property test | FR-01102, FR-01103, FR-01113, FR-01116, FR-01117, FR-01118, NFR-01101, NFR-01105 | `src/ui/studio/store.ts`, `src/ui/studio/panel/binding.ts`, `src/ui/studio/insertDefaults.ts`, `src/ui/studio/editing.test.ts` | `npx vitest run src/ui/studio/editing.test.ts` green, one `it` per id, 1 000 sequences with 0 invalid documents | - | | Q1 |
| T2 | panel frame with tabs, empty text, multi-selection note and read-only mode; bound controls with inline range messages; mount in the shell panel replacing `PanelHeader` | FR-01104, FR-01114, FR-01123, NFR-01102 | `src/ui/studio/panel/PropertyPanel.tsx`, `src/ui/studio/panel/controls.tsx`, `src/ui/studio/panel/controls.test.tsx`, `src/ui/shell/PropertyPanel.tsx` (and `src/ui/studio/PanelHeader.tsx` deleted), `src/ui/studio/panel/panel.module.css` | `npx vitest run src/ui/studio/panel/controls.test.tsx` green; 010's suite still green | T1 | | Q1 |
| T3 | Dados tab and draggable field chips with the compatibility toast | FR-01105, FR-01106, FR-01107 | `src/ui/studio/panel/DataTab.tsx`, `src/ui/studio/panel/FieldChips.tsx`, `src/ui/studio/panel/DataTab.test.tsx` | `npx vitest run src/ui/studio/panel/DataTab.test.tsx` green | T2 | P | Q1 |
| T4 | Aparência tab (four sections, table columns, move buttons, Duplicar/Remover) and Interações tab | FR-01108, FR-01109, FR-01110, FR-01111, FR-01112 | `src/ui/studio/panel/AppearanceTab.tsx`, `src/ui/studio/panel/InteractionsTab.tsx`, `src/ui/studio/panel/tabs.test.tsx` | `npx vitest run src/ui/studio/panel/tabs.test.tsx` green | T2 | P | Q1 |
| T5 | `Adicionar componente` dialog with the twelve options and the limit refusal; toolbar island wiring Inserir, Gráfico, Texto, Propriedades | FR-01101, FR-01102, FR-01103 | `src/ui/studio/InsertDialog.tsx`, `src/ui/studio/ToolbarActions.tsx`, `src/ui/shell/Toolbar.tsx`, `src/ui/studio/InsertDialog.test.tsx` | `npx vitest run src/ui/studio/InsertDialog.test.tsx` green; `npm run build` passes | T1 | P | Q1 |
| T6 | card editing: Ctrl/Cmd + click, `⧉` duplicate, inline title/body edit with Enter/Escape/blur, text and button widgets, read-only card | FR-01115, FR-01117, FR-01119, FR-01120, FR-01123 | `src/ui/studio/WidgetCard.tsx`, `src/ui/studio/InlineEdit.tsx`, `src/ui/studio/WidgetCard.test.tsx`, `src/ui/studio/widgets/TextWidget.tsx`, `src/ui/studio/widgets/ButtonWidget.tsx` (two ten-line siblings) | `npx vitest run src/ui/studio/WidgetCard.test.tsx` green | T1 | P | Q1 |
| T7 | image widget and `Inserir imagem` dialog with type/size/read errors; e2e for the Editor flow, the Leitor sweep and axe per widget type | FR-01121, FR-01122, NFR-01103, NFR-01104 | `src/ui/studio/widgets/ImageWidget.tsx`, `src/ui/studio/widgets/ImageDialog.tsx`, `src/ui/studio/widgets/ImageDialog.test.tsx`, `tests/e2e/011-widget-editing.spec.ts` | `npx vitest run src/ui/studio/widgets` green; `npm run test:e2e` green with axe zero serious/critical | T3, T4, T5, T6 | | Q1 |

Seven tasks rather than six because the panel's three tabs, the insert path
and the two card-editing families each need their own files to stay at four
per task. Nothing here is Q3 or Q4: no manifest, infrastructure,
authentication, authorisation, cryptography, migration or data deletion.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no filter editing or
      click behaviour, no measure editor, no drag/resize, no assistant tab,
      the filter widget is a placeholder card, `Filtros`, `Organizar`,
      `Apresentar`, `Exportar` and `Compartilhar` still do nothing, the four
      open questions and the assumptions the plan took for them.

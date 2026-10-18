# Specification: Widget editing

Status: draft
Owner: João Moog

## Problem

010-studio-canvas renders an analysis but nothing on it can be changed: the
toolbar's Inserir, Gráfico and Texto do nothing and the property panel is a
placeholder. In the prototype every property change goes through a coercing
sanitizer that silently clamps or drops what it does not like, so a typo in
the width becomes a different width and nobody is told; the same code path
serves single and multiple selection, inline title editing and image upload,
and all of it lives in three global event listeners. The rewrite keeps the
prototype's controls, labels and limits but changes the contract: a control
either produces a valid document or it is refused inline in pt-BR, and the
document is re-validated after every change so an invalid one can never reach
the autosave. Editores need the full Dados / Aparência / Interações panel to
build a dashboard; Leitores need to see the same panel without being able to
touch it.

## Goal

An Editor can insert, configure, duplicate and delete every widget type from
the toolbar, the property panel and the card itself — including inline title
and text editing, multi-selection with broadcast of visual keys, and image
upload — and after every change the document still validates.

## Out of scope

- Page-level and widget-level filter editing, the filter widget's behaviour,
  cross-filtering, details modal, and what a click on a mark or a button does
  — 013-filters-and-interactions. The `Filtro` option in the insert menu and
  the Interações controls only store values.
- Creating or editing measures and parameters (`＋ Criar medida calculada`
  opens nothing here) — 014-measures-and-parameters-ui.
- Drag reordering, pointer and keyboard resize, Organizar — 012-layout-drag-resize.
  The `← Anterior` / `Próximo →` buttons in the panel are in scope.
- The assistant tab and the before/after preview — 019-assistant-ui.
- Restoring the prototype's coercing behaviour: values are rejected, never
  corrected.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-01101 | Event | WHEN an Editor activates Inserir in the toolbar or the empty-page call to action, the studio SHALL open a dialog titled `Adicionar componente` offering exactly the twelve options `Colunas agrupadas`, `Barras horizontais`, `Linhas`, `Área`, `Rosca`, `Tabela`, `Cascata`, `Indicador`, `Texto`, `Imagem`, `Botão` and `Filtro`. |
| FR-01102 | Event | WHEN an option is chosen (or Texto is activated in the toolbar, which adds a text widget directly), the studio SHALL append to the active page a widget with the defaults defined in 002-domain-schema, titled with the option's label, with dimension `category` for bar, donut, table, waterfall and indicator and `month` otherwise, span 3 for indicator and filter and 6 otherwise, height 280 for image, 200 for text, button, filter and indicator and 330 otherwise, select it alone, show the toast `Componente adicionado.` and open the property panel. |
| FR-01103 | Unwanted | IF the document already holds 100 widgets, THEN inserting or duplicating SHALL be refused with a toast naming the limit of 100 and the document SHALL be unchanged. |
| FR-01104 | Ubiquitous | The property panel SHALL show the title `Propriedades`, the tabs `Dados`, `Aparência` and `Interações`, and, with nothing selected, the text `Adicione ou selecione um componente.`; every control SHALL have a visible label and show the current value of the primary selected widget. |
| FR-01105 | Ubiquitous | For a data widget (column, bar, line, area, donut, table, waterfall, indicator) the Dados tab SHALL offer the field chips `Mês`, `Área`, `Categoria`, `Realizado`, `Orçamento`, `Registros` and one per measure with the help `Arraste um campo para um seletor ou escolha na lista.`, the selects `Eixo / dimensão`, `Valor`, `Comparação` (with `Nenhuma`), `Séries / legenda` (with `Realizado × comparação`), `Agregação` (`Soma`, `Média`, `Contagem`, `Mínimo`, `Máximo`), `Ordenar` (`Dimensão`, `Maior valor primeiro`, `Menor valor primeiro`) and the number field `Quantidade (0 = todos)` from 0 to 50, plus the help `A dimensão cria séries e substitui a comparação neste gráfico.` while a series field is set. |
| FR-01106 | State | WHILE the primary selected widget is a text, image, button or filter widget, the Dados tab SHALL show only `Este componente não utiliza medidas. Configure seu conteúdo na aba Aparência.` |
| FR-01107 | Complex | WHEN a field chip is dropped on a Dados select, IF that select offers the chip's value, THEN the studio SHALL apply it as if chosen from the list; otherwise it SHALL show the toast `Esse campo não é compatível com este seletor.` and change nothing. |
| FR-01108 | Ubiquitous | The Aparência tab SHALL open with the section `Componente` offering `Tipo` (the twelve types), `Título`, `Subtítulo` (at most 200 characters), a `Conteúdo` text area for text and button widgets or `Descrição acessível` for image widgets, `Escolher imagem` and `Enquadramento` (`Mostrar inteira`, `Preencher espaço`) for image widgets and `Página de destino` for button widgets, followed by the section `Aparência` offering `Cor principal`, `Cor secundária`, `Fundo`, `Texto`, `Fonte` (`Segoe UI`, `Arial`, `Georgia`), `Título (px)` from 12 to 30 and `Texto (px)` from 10 to 22. |
| FR-01109 | State | WHILE the primary selected widget is a data widget, the Aparência tab SHALL also show the section `Números e gráfico` offering `Formato` (`Número`, `Moeda (R$)`, `Percentual`), `Unidade` (`Inteiro`, `Milhares`, `Milhões`), `Casas decimais` from 0 to 4, the toggles `Mostrar legenda`, `Mostrar rótulos`, `Mostrar eixos` and `Mostrar linhas de grade`, `Meta (0 = ocultar)`, `Destaque condicional` (`Sem destaque`, `Valor acima da comparação`, `Valor acima da meta`) and `Cor do destaque`, and for a table the checkboxes `Dimensão`, `Valor`, `Comparação`, `Diferença` bound to its columns. |
| FR-01110 | Unwanted | IF the last checked table column is unchecked, THEN the studio SHALL keep the `Dimensão` column checked and the table SHALL show that column alone. |
| FR-01111 | Ubiquitous | The Aparência tab SHALL end with the section `Tamanho e bordas` offering `Largura (3–12 colunas)`, `Altura (px)` from 180 to 800 in steps of 10, `Espaçamento interno` from 0 to 36, `Borda (px)` from 0 to 4, `Cor da borda`, `Cantos (px)` from 0 to 24 and the buttons `← Anterior` and `Próximo →` that move the widget one position earlier or later on its page, followed by the buttons `Duplicar` and `Remover`. |
| FR-01112 | Ubiquitous | The Interações tab SHALL offer, under `Ao clicar em um dado`, `Ação` (`Apenas selecionar`, `Filtrar os outros gráficos`, `Abrir registros de origem`, `Navegar para outra página`) and `Página de destino` (`Escolha uma página` plus every page of the document) with the help `O filtro cruzado atua na página atual. Clique novamente no mesmo valor para removê-lo.`, and an `Atalhos` section listing the double-click, Ctrl/Cmd + click, Ctrl/Cmd + Z and resize-corner shortcuts; the values are stored only. |
| FR-01113 | Event | WHEN a control is committed (a select or toggle changes, a colour is picked, a text field loses focus or a number field changes), the studio SHALL write the value into the selected widget, re-validate the whole document as defined in 002-domain-schema, repaint the affected cards, and record exactly one undo entry. |
| FR-01114 | Unwanted | IF the committed value is outside the control's range, not one of its options, or an empty number, THEN the studio SHALL leave the document unchanged and show, next to the control, a pt-BR message naming the allowed range or options. |
| FR-01115 | Event | WHEN a card is clicked, the studio SHALL replace the selection with that widget, or toggle it within the selection when Ctrl or Cmd is held, showing the panel note `<N> componentes selecionados. Ajustes visuais e de tamanho serão aplicados a todos.` while more than one is selected. |
| FR-01116 | State | WHILE more than one widget is selected, a committed change to `color`, `comparisonColor`, `background`, `textColor`, `borderColor`, `font`, `fontSize`, `titleSize`, `padding`, `radius`, `border`, `height`, `span`, `legend`, `labels`, `axes`, `grid`, `unit`, `decimals` or `format` SHALL be applied to every selected widget, and a change to any other key SHALL be applied to the primary selected widget only. |
| FR-01117 | Event | WHEN `Duplicar` is activated in the panel or the card's `⧉` button (accessible name `Duplicar <title>`), the studio SHALL insert, right after the original, a copy with a new id and the title `<title> · cópia`, select the copy alone and show the toast `Componente duplicado.` |
| FR-01118 | Event | WHEN `Remover` is activated, the studio SHALL delete every selected widget from its page and from the document, select the page's first remaining widget, and show the toast `Removido. Use Desfazer para recuperar.` |
| FR-01119 | Event | WHEN a card's title or a text widget's body is double-clicked, the studio SHALL make it editable with its content selected; Enter in a title SHALL commit, Escape SHALL cancel and restore the previous value, and losing focus SHALL commit the trimmed text truncated to 150 characters for a title or 4 000 for a body, replacing an empty title with `Sem título`. |
| FR-01120 | Ubiquitous | A text widget SHALL render its body preserving line breaks or, when empty, `Clique duas vezes para escrever uma observação.`; a button widget SHALL render its label or, when empty, `Abrir página`; both `Conteúdo` controls SHALL accept at most 4 000 characters. |
| FR-01121 | Event | WHEN a file is chosen through the dialog `Inserir imagem` (opened by the card's `Escolher uma imagem` button, shown while the widget has no image, or by the panel's `Escolher imagem`, and stating `PNG, JPEG ou WebP, até 1 MB.`), the studio SHALL embed the image in the widget, show it fitted by `Enquadramento` with the alternative text from `Descrição acessível` or the title, and show the toast `Imagem adicionada.` |
| FR-01122 | Unwanted | IF the chosen file is not PNG, JPEG or WebP, is larger than 1 MB, or cannot be read, THEN the dialog SHALL show `Escolha PNG, JPEG ou WebP de até 1 MB.` (or `Não foi possível ler a imagem.` for a read failure) and the widget SHALL be unchanged. |
| FR-01123 | State | WHILE the signed-in member is a Leitor, the studio SHALL render the panel's values as read-only, SHALL not render Inserir's dialog, the `⧉` button, `Duplicar`, `Remover`, `Escolher imagem` or inline editing, and SHALL send no write request. |
| NFR-01101 | Ubiquitous | A property-style test SHALL apply 1 000 seeded random sequences of 20 control commits (any key, any value the control can produce, single and multiple selection) to the demo document and find the document valid after every commit, with 0 failures. |
| NFR-01102 | Ubiquitous | Changing the selection SHALL repaint the property panel within 100 ms in the unit-test environment, and a committed change SHALL re-render only the cards whose widget changed (renderer calls equal to the number of changed widgets). |
| NFR-01103 | Ubiquitous | Embedding a 1 MB image SHALL finish within 500 ms and produce a document that still validates, including the encoded-image length limit defined in 002-domain-schema. |
| NFR-01104 | Ubiquitous | Every control of the three tabs SHALL be reachable with Tab in reading order and operable with the keyboard alone, and an automated accessibility scan of the panel with each of the twelve widget types selected SHALL report zero violations of impact `serious` or `critical`. |
| NFR-01105 | Ubiquitous | Typing in `Título`, `Subtítulo` or `Conteúdo` SHALL update the card live on every keystroke and record at most one undo entry per committed field, not one per keystroke. |

## Open questions

`[NEEDS CLARIFICATION: confirm before delete — the prototype removes immediately and relies on `Desfazer`; a confirmation dialog for multi-selection or for widgets with images changes FR-01118 and adds a modal.]`

`[NEEDS CLARIFICATION: the broadcast key list in FR-01116 is the prototype's; is `target`, `condition`/`conditionColor` or `type` meant to broadcast too? Each added key widens what a multi-selection can change at once.]`

`[NEEDS CLARIFICATION: image limit measured on the file (1 MB, prototype) or on the encoded data URL (the schema's length cap)? A 1 MB file encodes to about 1.37 M characters, under the cap, but a stricter cap would make FR-01122 refuse files the dialog text accepts.]`

`[NEEDS CLARIFICATION: title length — 002-domain-schema allows 150 characters, the prototype's `Título` field and inline edit stop at 100; FR-01119 assumes 150 everywhere; confirm so the field's maxlength and the schema agree.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/011-widget-editing
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

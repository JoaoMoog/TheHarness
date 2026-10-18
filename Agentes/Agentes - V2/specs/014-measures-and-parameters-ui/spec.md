# Specification: Measures and parameters UI

Status: draft
Owner: João Moog

## Problem

The formula interpreter from 004-formula-interpreter can evaluate `orcado -
realizado` or `realizado / colaboradores` over a recorte, and the document schema
holds up to 30 measures and 20 parameters, but no screen lets an Editor create,
edit, validate or apply a measure, and no widget can show one. The prototype's
"ƒ Medidas" dialog does this with live pt-BR validation against the current
recorte, three canned formulas, automatic application to the selected widget and a
parameter editor with key rules and reserved names; it never offered deletion, so a
wrong measure stayed in the document forever, and it silently overwrote an
existing parameter through the "new parameter" field. A finance analyst who cannot
express "cost per employee" or "deviation in percent" inside the studio computes it
outside and pastes the number into a text widget, where it never updates.

## Goal

An Editor creates, edits, validates, applies and removes calculated measures and
parameters from the context bar, with every error shown in pt-BR before saving, and
any widget can use a measure as its value or comparison and shows a clear error
state when the formula cannot be evaluated for its recorte.

## Out of scope

- The formula language, its tokenizer, parser, evaluator, limits and error
  catalogue (defined in 004-formula-interpreter); this specification quotes its
  messages and never re-defines them.
- How a measure is evaluated over a widget's group totals (defined in
  003-query-engine and 004-formula-interpreter).
- The property panel frame, the `Dados` tab and its `Valor` / `Comparação`
  controls (defined in 011-widget-editing); this specification adds measures to
  their option lists.
- Measures referencing other measures (excluded by 004-formula-interpreter).
- Workspace-level parameters shared across analyses (open question below;
  parameters stay per analysis until answered).

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-01401 | Event | WHEN an Editor activates `ƒ Medidas` in the context bar, a dialog titled `Medidas calculadas` SHALL open with the text `Fórmulas calculadas sobre os totais de cada grupo. Use realizado, orcado, registros e parâmetros.`, the list of existing measures (name, expression, `Editar`, `Excluir`), a form with the fields `Nome`, `Fórmula` and `Formato` (`Número`, `Moeda (R$)`, `Percentual`), the result line `A validação mostrará o resultado para o recorte atual.`, the buttons `Validar fórmula` and `Salvar medida`, and a collapsed section `Parâmetros do dashboard`. |
| FR-01402 | Ubiquitous | The `Nome` field SHALL accept at most 70 characters and the `Fórmula` field at most 300, both required, with the placeholders `Ex.: Custo por colaborador` and `realizado / colaboradores`. |
| FR-01403 | Event | WHEN one of the suggestion buttons `Saldo`, `Desvio %` or `Custo por colaborador` is activated, the form SHALL be filled with, respectively, `Saldo` / `orcado - realizado` / `Moeda (R$)`, `Desvio percentual` / `(realizado - orcado) / orcado * 100` / `Percentual`, `Custo por colaborador` / `realizado / colaboradores` / `Moeda (R$)`, and validated immediately. |
| FR-01404 | Event | WHEN the `Fórmula` field has been idle for 300 ms after a change, or `Validar fórmula` is activated, the expression SHALL be evaluated with `realizado` and `orcado` equal to the totals of the dashboard recorte, `registros` equal to its row count and every parameter by key, and the result line SHALL read `Resultado no recorte: <número pt-BR com até 4 decimais>`. |
| FR-01405 | Unwanted | IF the evaluation fails, THEN the result line SHALL show the interpreter's pt-BR message (for example `Variável desconhecida: xyz`, `Divisão por zero neste recorte.`, `Feche os parênteses.`, `Expressão inválida.`, `Use números, variáveis, parênteses e + − * /.`) and `Salvar medida` SHALL leave the dialog open with the document unchanged. |
| FR-01406 | Event | WHEN `Salvar medida` is submitted with a validated form, the measure SHALL be added with a new id, or replaced in place when the form was opened by `Editar`, the dialog SHALL close and one history entry SHALL be added. |
| FR-01407 | Complex | WHEN a measure is saved, IF exactly one widget is selected, THEN that widget's value SHALL become the measure, its format the measure's format, its decimals 1 for `Percentual` and 2 otherwise, and the toast `Medida salva e aplicada ao componente selecionado.` SHALL be shown. |
| FR-01408 | Event | WHEN a measure is saved with no single widget selected, the toast `Medida salva.` SHALL be shown and no widget SHALL change. |
| FR-01409 | Unwanted | IF the analysis already holds 30 measures and a new one is submitted, THEN the save SHALL be refused with `Limite de 30 medidas por análise.` and the list SHALL stay unchanged. |
| FR-01410 | Event | WHEN `Editar` is activated on a listed measure, the form SHALL be filled with that measure's name, expression and format and validated immediately, with `Salvar medida` replacing that measure. |
| FR-01411 | Ubiquitous | The `Valor` control of a data-bound widget SHALL list `Realizado`, `Orçamento`, `Registros` and then every measure by name in list order, and the `Comparação` control SHALL list `Nenhuma` followed by the same options. |
| FR-01412 | Unwanted | IF a widget's measure cannot be evaluated for one of its groups or its total, THEN that value SHALL render as `—`, the card SHALL show the interpreter's message as a note below the content, and every other widget SHALL render normally. |
| FR-01413 | Complex | WHEN `Excluir` is activated on a listed measure, IF no widget uses it as value or comparison, THEN the measure SHALL be removed in one history entry and the toast `Medida excluída.` SHALL be shown. |
| FR-01414 | Unwanted | IF `Excluir` is activated on a measure used by one or more widgets, THEN the removal SHALL be refused with `Medida em uso por <n> componente(s).` and nothing SHALL change. |
| FR-01415 | Ubiquitous | The section `Parâmetros do dashboard` SHALL list every parameter as a numeric field labelled with its key and a `Remover` button, followed by the fields `Novo parâmetro` (placeholder `ex.: unidades`) and `Valor` (default `1`) and the button `Salvar parâmetros`. |
| FR-01416 | Event | WHEN `Salvar parâmetros` is submitted, every listed parameter SHALL take its field value, a new parameter SHALL be added when `Novo parâmetro` is filled, one history entry SHALL be added, the toast `Parâmetros atualizados.` SHALL be shown and every widget using a measure SHALL recompute. |
| FR-01417 | Unwanted | IF `Novo parâmetro` does not match one lowercase letter followed by up to 30 lowercase letters, digits or underscores, or is one of `realizado`, `orcado`, `registros`, `constructor`, `prototype`, `__proto__`, THEN the submission SHALL be refused with `Nome de parâmetro inválido ou reservado.` and nothing SHALL change. |
| FR-01418 | Unwanted | IF `Novo parâmetro` names a parameter that already exists, THEN the submission SHALL be refused with `Parâmetro já existe.` and nothing SHALL change. |
| FR-01419 | Unwanted | IF the analysis already holds 20 parameters and `Novo parâmetro` is filled, THEN the submission SHALL be refused with `Limite de 20 parâmetros por análise.` and nothing SHALL change. |
| FR-01420 | Complex | WHEN `Remover` is activated on a parameter, IF no measure expression references its key, THEN the parameter SHALL be removed in one history entry. |
| FR-01421 | Unwanted | IF `Remover` is activated on a parameter referenced by one or more measure expressions, THEN the removal SHALL be refused with `Parâmetro usado em <n> medida(s).` and nothing SHALL change. |
| FR-01422 | Event | WHEN undo is invoked after a save or removal of this specification, the measures, parameters and any widget binding changed by that single action SHALL return to their previous values. |
| FR-01423 | State | WHILE the current user is a Leitor, the `ƒ Medidas` button SHALL be absent and no measure or parameter write SHALL be sent, while widgets bound to measures SHALL still render their values. |
| NFR-01401 | Ubiquitous | The validation result of FR-01404 SHALL appear within 150 ms of the trigger for a source of 5 000 rows and 20 parameters. |
| NFR-01402 | Ubiquitous | Saving a measure or parameters on an analysis of 100 widgets SHALL repaint the active page within 200 ms. |
| NFR-01403 | Ubiquitous | Each save or removal in this specification SHALL add exactly 1 history entry and trigger exactly 1 autosave request. |
| NFR-01404 | Ubiquitous | The dialog SHALL be fully operable by keyboard and an automated accessibility scan with the dialog open, one error shown and the parameters section expanded SHALL report zero violations of impact `serious` or `critical`. |

## Open questions

`[NEEDS CLARIFICATION: removing a measure that widgets use — refuse naming the count (assumed above) or remove and fall back those widgets to `Realizado`? Fallback changes the store action and needs a widget-level toast.]`

`[NEEDS CLARIFICATION: are parameters per analysis (prototype) or per workspace shared by every analysis? Workspace parameters need a table, a handler and a permission, and the lineage shows a different origin.]`

`[NEEDS CLARIFICATION: is `Resultado no recorte` evaluated on the dashboard recorte (prototype) or on the selected widget's effective recorte? The second reads different totals when page or widget filters are set and changes the evaluation inputs.]`

`[NEEDS CLARIFICATION: must measure names be unique within an analysis? The prototype allowed duplicates, which produce indistinguishable entries in the `Valor` control; uniqueness adds a refusal message and a check on rename.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/014-measures-and-parameters-ui
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

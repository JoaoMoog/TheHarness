# Specification: Assistant interface

Status: draft
Owner: João Moog

## Problem

In the prototype the assistant is a box painted under the property controls
(`paintAssistant` in `studio-engine.js`): one input, three suggestion buttons, the
last answer, and the line "IA guiada · demonstração". A command that the browser-side
intent table understood opened a "Prévia da alteração sugerida" modal with a before and
an after pane and applied the change to every selected widget on "Aplicar alterações";
anything else produced a canned sentence. That flow — preview first, apply only on
confirmation, undoable, working on a multi-selection — is the part worth keeping. What
changes is where the answer comes from: the interface now calls the server assistant of
018-assistant-service, waits for it, and must show loading, timeout, rate-limit and
error states the prototype never had, while still never applying anything the person
did not confirm.

Two wordings change on purpose: the modal no longer says "Assistente demonstrativo com
comandos guiados", and the footer line "IA guiada · demonstração" is replaced by a line
that states the actual guarantee. The transcript is kept in memory for the open analysis
and is not persisted (see open questions).

## Goal

A person editing an analysis can describe a change or ask a question in an assistant tab
of the property panel, see the proposed change side by side with the current one, and
apply it to every selected widget as one undoable step, with every waiting and failure
state visible and announced.

## Out of scope

- Interpreting the message, validating the proposal, rate limits and the model provider
  (018-assistant-service). The interface trusts only what that service returns and the
  domain schema accepts.
- Persisting the transcript across reloads or between people.
- Routing the home page prompt through the assistant; 016-home-and-planning keeps its
  deterministic parser unless the open question below says otherwise.
- Streaming answers, voice input, attachments.
- Editing widgets through the property controls (011-widget-editing); this tab only
  applies proposals.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-01901 | Ubiquitous | The property panel SHALL offer a tab labelled `Assistente` beside the editing tabs, containing the heading `Assistente Prometeu`, the transcript, the message form and the suggestion chips. |
| FR-01902 | Ubiquitous | The message form SHALL consist of a text input with the accessible name `Peça uma alteração ao assistente` and the placeholder `Descreva uma alteração...`, and a submit button with the accessible name `Enviar alteração`, submitted by Enter as well. |
| FR-01903 | State | WHILE the transcript is empty, the tab SHALL show the text `Posso alterar gráficos, explicar variações, filtrar a análise e gerar uma apresentação. Selecione um gráfico e descreva o ajuste.` in the answer region. |
| FR-01904 | Event | WHEN a non-empty message is submitted, the tab SHALL send it to the assistant service together with the selection: every id of the multi-selection when one exists, otherwise the selected widget's id, otherwise no id. |
| FR-01905 | Event | WHEN an answer arrives, the tab SHALL append the person's message and the answer text to the transcript, the answer inside a region with `aria-live="polite"`. |
| FR-01906 | Unwanted | IF the submitted message is empty or only whitespace, THEN the tab SHALL send nothing and add nothing to the transcript. |
| FR-01907 | State | WHILE a message is awaiting its answer, the tab SHALL disable the submit button and show `Consultando o assistente…` in the answer region marked `aria-busy="true"`. |
| FR-01908 | Unwanted | IF the service answers with an error (400, 401, 404, 429, 504 or a network failure), THEN the tab SHALL show the error's pt-BR message as an error turn in the transcript with a `Tentar novamente` button that resends the same message, leaving the input enabled. |
| FR-01909 | Unwanted | IF no answer arrives within 30 seconds, THEN the tab SHALL abandon the request and show `O assistente não respondeu a tempo. Tente novamente.` as an error turn. |
| FR-01910 | Event | WHEN the answer is a widget patch, the tab SHALL open a modal titled `Prévia da alteração sugerida` with the line `{n} componente(s) selecionado(s).`, a pane `Antes · {title}` rendering the first target widget as it is and a pane `Depois · {title}` rendering the same widget with the patch applied, both through the canvas renderers over the same data. |
| FR-01911 | Ubiquitous | The preview modal SHALL list the patch as `Label: value` pairs joined by ` · `, with the labels `Tipo`, `Limite`, `Ordem`, `Destaque`, `Cor`, `Largura`, `Título`, `Dimensão`, `Unidade`, `Legenda`, `Rótulos` for the keys `type`, `top`, `sort`, `condition`, `conditionColor`, `span`, `title`, `dimension`, `unit`, `legend`, `labels`, and the values `Colunas agrupadas`, `Barras horizontais`, `Linhas`, `Área`, `Rosca`, `Tabela`, `Maior valor primeiro`, `Menor valor primeiro`, `Acima da comparação`, `Categoria`, `Mês`, `Sim`, `Não`, `Milhões`, `Milhares` for `column`, `bar`, `line`, `area`, `donut`, `table`, `desc`, `asc`, `budget`, `category`, `month`, `true`, `false`, `mi`, `mil`, and any other value shown as is. |
| FR-01912 | Event | WHEN `Aplicar alterações` is activated in the preview modal, the tab SHALL apply the patch to every target widget in one document mutation, so that a single undo restores every target. |
| FR-01913 | Event | WHEN the patch has been applied, the tab SHALL append the answer `Alterações aplicadas a {n} componente(s). Você pode desfazer ou ajustar nas propriedades.` to the transcript, with `{n}` the number of widgets changed. |
| FR-01914 | Event | WHEN `Cancelar` is activated or the modal is closed with Escape, the document SHALL be unchanged and no undo entry SHALL exist for the proposal. |
| FR-01915 | Unwanted | IF a target widget no longer exists in the document when `Aplicar alterações` is activated, THEN the patch SHALL apply to the remaining targets and the applied-count message SHALL count only those. |
| FR-01916 | State | WHILE the acting person holds the Leitor role, the preview modal SHALL render `Aplicar alterações` disabled with the note `Somente editores aplicam alterações.`, while text answers and previews remain available. |
| FR-01917 | Event | WHEN the answer is a dashboard proposal, the tab SHALL open the same modal with the rows `Área`, `Período` and `Tipo` for the proposed values and the line `{records} registros no recorte`. |
| FR-01918 | Event | WHEN `Aplicar alterações` is activated for a dashboard proposal, the tab SHALL set the dashboard filters `area` and `period` and the type of the first month-dimension chart widget (`bar` becoming `column`) in one undoable mutation. |
| FR-01919 | Ubiquitous | Below the form the tab SHALL render the heading `Alterações com prévia` and three chips whose labels are `Barras · top 5 · destacar desvios`, `Linhas sem legenda` and `Explicar variação do saldo`, which submit the messages `Barras horizontais com cinco maiores por categoria e destaque acima do orçamento em vermelho`, `Troque para linhas sem legenda` and `Explique a variação do saldo` respectively. |
| FR-01920 | Ubiquitous | The tab SHALL render the line `IA com prévia · nada é aplicado sem confirmação` under the chips. |
| FR-01921 | Event | WHEN the rail entry `IA` is activated, the application SHALL show the studio of the current analysis with the property panel open (also at widths of 760 px or narrower), the `Assistente` tab selected and keyboard focus in the message input. |
| FR-01922 | Event | WHEN the transcript toggle with the accessible name `Recolher resposta` is activated, the tab SHALL hide every turn but the latest answer and rename the toggle `Ver resposta`, and the reverse on the next activation. |
| FR-01923 | Event | WHEN the analysis is reloaded or another analysis is opened, the transcript SHALL start empty. |
| NFR-01901 | Ubiquitous | An automated accessibility scan of the assistant tab and of the open preview modal SHALL report zero violations of impact `serious` or `critical`. |
| NFR-01902 | Ubiquitous | The preview modal SHALL render both panes within 200 ms of the answer arriving for a widget of 50 categories, measured in the unit test environment. |
| NFR-01903 | Ubiquitous | The transcript SHALL hold at most 50 turns in memory, dropping the oldest first. |
| NFR-01904 | Ubiquitous | Each answer SHALL be announced by the live region exactly once; a re-render of the tab SHALL not change the live region's text. |

## Open questions

`[NEEDS CLARIFICATION: transcript persistence — is the conversation stored with the analysis (as the prototype's `messages[]` was) or kept in memory only, as assumed here? Storing it adds a write path and a field to the document.]`

`[NEEDS CLARIFICATION: the home page prompt — does it stay deterministic as 016-home-and-planning specifies, or fall through to the assistant when nothing is recognised? The latter adds a call from the home page and a text result area.]`

`[NEEDS CLARIFICATION: does a Leitor receive proposals to preview (the Leitor row assumes yes, with apply disabled), or only text answers? The answer must match the service's decision.]`

`[NEEDS CLARIFICATION: should a dashboard proposal show a rendered before/after of the affected chart, or only the value rows of the dashboard-proposal row?]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/019-assistant-ui
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

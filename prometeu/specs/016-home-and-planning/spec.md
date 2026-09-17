# Specification: Home and planning

Status: draft
Owner: João Moog

## Problem

The prototype's home page turns a typed question or a suggestion chip into a new
dashboard, and its planning page lets a manager move three sliders and save the
resulting scenario. Both work only inside one browser: the home greets a hard-coded
`Olá, João.`, shows a fake 700 ms "loading" line, always lists the same example card
under `Continue de onde parou`, and the planning page keeps scenarios in localStorage
(`Cenário salvo neste navegador.`, tag `Neste navegador`) with no way to remove one and
no notion of who saved it. The governance page hand-types a `Rastro da análise atual`
paragraph that repeats whatever the dashboard happens to show, so it cannot be trusted
as lineage.

The rewrite keeps the deterministic pt-BR prompt parser (no language model is
consulted; the assistant may be layered on later), greets the signed-in member by
name, lists the workspace's real recent analyses, stores scenarios on the server per
workspace with an author and a removal action, replaces the two "neste navegador"
strings with `Cenário salvo.` and the workspace name, renders the lineage panel on the
governance page from the same component the studio uses, and applies roles: a Leitor
may simulate but not save.

## Goal

A member lands on a home page that turns a question or a chip into a new analysis or a
planning scenario, simulates cost scenarios with three sliders whose numbers update
live, and keeps named scenarios that every member of the workspace can see.

## Out of scope

- Interpreting the prompt with a language model; the parser is a fixed grammar.
- Charts comparing several scenarios, scenario approval workflows, write-back to SAP.
- Persisting the prompt as an assistant message on the created analysis.
- Editing a saved scenario; scenarios are saved, listed and removed.
- The roles table and member list of the governance page (owned by
  006-workspaces-and-roles) and the lineage component itself (owned by
  013-filters-and-interactions); this spec only places the component on the page.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-01601 | Ubiquitous | The home page SHALL render the eyebrow `SEU PONTO DE PARTIDA`, the name of the current workspace, the headline `Boas perguntas.` followed by `Grandes descobertas.`, the greeting `Olá, {primeiro nome}. O que seus dados podem responder hoje?`, a text area with the accessible name `Sua pergunta para o Prometeu` and the placeholder `Crie um dashboard com os custos da minha área neste mês...`, a pill naming the current source, the hint `Enter para enviar` and a submit button named `Enviar pergunta`. |
| FR-01602 | Ubiquitous | The home page SHALL render three suggestion chips labelled `Custos da minha área`, `Realizado × orçamento` and `Simular um cenário` whose prompts are, respectively, `Crie um dashboard dos custos da minha área em setembro`, `Compare o realizado com o orçamento` and `Simule uma redução de custos de 10%`. |
| FR-01603 | Event | WHEN a suggestion chip is activated, the system SHALL submit its prompt exactly as if the member had typed it and pressed Enter. |
| FR-01604 | Event | WHEN Enter is pressed in the text area without Shift, the system SHALL submit the prompt (Shift+Enter keeps the text area's native line break). |
| FR-01605 | Ubiquitous | The section `Continue de onde parou` SHALL show the link `Ver meus dashboards` to the library and the three most recently updated analyses of the current workspace as cards showing title, area and period, each opening that analysis, or, when the workspace has no analysis, a card that creates the demo analysis. |
| FR-01606 | Ubiquitous | The system SHALL interpret a prompt deterministically, producing for the same prompt on the same source always the same intent, area, period and title, without any request to a language model. |
| FR-01607 | Event | WHEN the submitted prompt, lower-cased, contains `simul`, `cenario`, `cenário`, `reduc` or `reduç`, the system SHALL navigate to the planning page without creating an analysis. |
| FR-01608 | Complex | WHEN a prompt of FR-01607 is submitted, IF it contains the digits `10`, THEN the system SHALL set the three planning sliders to `-10` before the planning page renders (otherwise the sliders keep their values). |
| FR-01609 | Complex | WHEN a prompt that does not match FR-01607 is submitted, IF its lower-cased, accent-stripped text contains none of `custo`, `orcamento`, `dashboard`, `realizado`, `despesa`, `tecnologia`, `operac`, `comercial`, THEN the system SHALL show, in a live region, `Este assistente usa exemplos guiados. Experimente “custos da minha área”, “realizado × orçamento” ou “simular cenário”.` and create nothing. |
| FR-01610 | Event | WHEN a prompt matching one of the words of FR-01609 is submitted, the system SHALL create an analysis in the current workspace from the current source with the default document, whose area is `Operações` when the prompt contains `opera`, `Comercial` when it contains `comercial` or `vendas`, `Todas as áreas` when it contains `todas as áreas` (accent-insensitive), and otherwise the area of the source's first row; an area is applied only if the source holds rows of that area. |
| FR-01611 | Ubiquitous | The analysis created by FR-01610 SHALL take as period the month named in the prompt (`janeiro` … `dezembro`, accent-insensitive) when the source holds rows of that month, choosing the most recent such month, and otherwise the most recent month present in the source. |
| FR-01612 | Ubiquitous | The analysis created by FR-01610 SHALL open in the studio once created, titled `Visão de custos · {área}` when the source is the demo source and `Análise · {nome da fonte}` when it is an imported source. |
| FR-01613 | Unwanted | IF the submitted prompt is empty or only whitespace, THEN the system SHALL show `Digite uma pergunta ou escolha uma sugestão.` and create nothing. |
| FR-01614 | Unwanted | IF the current source has no rows, THEN the system SHALL show `Importe uma fonte com dados válidos primeiro.` and create nothing. |
| FR-01615 | Unwanted | IF a Leitor submits a prompt that would create an analysis, THEN the system SHALL show `Somente Editores e Administradores criam análises. Você pode simular cenários em Planejar.` and create nothing. |
| FR-01616 | Ubiquitous | The planning page SHALL render the heading `Antes de decidir, simule.`, the line `Planejamento para {área} · {período}` of the base analysis, the label `Custo da base selecionada` with the base cost, the section `Ajuste as premissas` with three sliders labelled `Infraestrutura e licenças`, `Pessoas` and `Demais categorias`, each ranging from -30 to 30 in steps of 1, with the accessible name `Variação de {rótulo}` and a visible value `+N%` for positive and `N%` for zero or negative values, and the callout `Simulação aritmética, sem previsão por IA. Não grava no SAP e não representa uma aprovação de orçamento.`. |
| FR-01617 | Ubiquitous | The base of a simulation SHALL be the rows of the base analysis's source under that analysis's dashboard-level period, area and categories, each row grouped as `infra` when its category is `Infraestrutura` or `Licenças`, `people` when it is `Pessoas`, and `services` otherwise. |
| FR-01618 | Ubiquitous | The scenario result SHALL be the sum over base rows of `realizado × (1 + variação do grupo / 100)`, its delta the base cost minus the result, and `Saldo sobre orçamento` the base budget minus the result, each formatted in pt-BR currency. |
| FR-01619 | Event | WHEN a slider value changes, the system SHALL update, without a page reload, the slider's visible value, the result, the tag `Economia de {valor}` when the delta is zero or positive or `Acréscimo de {valor}` when it is negative, the three bars `Atual`, `Cenário` and `Orçamento`, and `Saldo sobre orçamento` (marked as negative when below zero). |
| FR-01620 | Event | WHEN `Restaurar` is activated, the system SHALL set the three sliders to 0 and recompute the numbers. |
| FR-01621 | Ubiquitous | The three sliders SHALL be operable with the keyboard, changing by 1 per arrow key press and by 10 per Page Up or Page Down, with the visible value following each change. |
| FR-01622 | Event | WHEN `Salvar cenário` is activated, the system SHALL open the form `Salvar cenário` with the field `Nome do cenário` pre-filled with `Cenário {n+1}` where n is the number of saved scenarios, the note `Resultado: {valor}` and the action `Salvar cenário`. |
| FR-01623 | Event | WHEN the form of FR-01622 is confirmed, the system SHALL store, in the current workspace, a scenario holding the trimmed name, the saving member, the creation time, the base cost, the budget, the result, the delta, the area, the period and the three slider values, then show `Cenário salvo.`. |
| FR-01624 | Ubiquitous | The section `Cenários salvos` SHALL list the workspace's scenarios newest first in a table with the columns `Cenário`, `Contexto` (`{área} · {período}`), `Base`, `Resultado` and `Economia`, the delta marked as positive when zero or above and as negative otherwise, each row with a `Remover` action, or `Ajuste as premissas e salve seu primeiro cenário para comparar decisões.` when there is none. |
| FR-01625 | Event | WHEN `Remover` is confirmed for a scenario, the system SHALL remove it so that it no longer appears in `Cenários salvos` for any member. |
| FR-01626 | State | WHILE the acting member is a Leitor, the planning page SHALL keep the sliders and `Restaurar` working while hiding `Salvar cenário` and `Remover` behind the note `Leitores podem simular, mas não salvar cenários.`. |
| FR-01627 | Unwanted | IF a Leitor requests to save or remove a scenario through any interface, THEN the system SHALL refuse with a forbidden response carrying a pt-BR message and change nothing. |
| FR-01628 | Unwanted | IF `Nome do cenário` is empty after trimming or exceeds 100 characters, THEN the system SHALL refuse to save, naming the field and the limit of 100 characters. |
| FR-01629 | Unwanted | IF the base analysis's selection holds no rows, THEN the planning page SHALL disable the three sliders and `Salvar cenário` and show `Nenhum dado no recorte da análise base. Ajuste os filtros da análise ou importe uma fonte.`. |
| FR-01630 | Unwanted | IF the current workspace holds no analysis, THEN the planning page SHALL show `Crie uma análise em Início para simular cenários.` with a link to the home page instead of the sliders. |
| FR-01631 | Unwanted | IF a scenario addressed belongs to a workspace the acting user is not a member of, or was already removed, THEN the system SHALL respond as not found without revealing whether it exists. |
| FR-01632 | Ubiquitous | The governance page SHALL render the panel `Rastro da análise` for the base analysis, showing its source, the measure line `Medida de custo: soma de “realizado”. Saldo: orçamento − realizado.`, the dashboard-level, page and widget filters in effect, its measures, and the line `Projeção: média dos últimos 3 meses disponíveis até a data-base. Não é modelo preditivo.`. |
| NFR-01601 | Ubiquitous | After a slider change, the numbers of FR-01619 SHALL be updated within 100 ms for a base of 5000 rows. |
| NFR-01602 | Ubiquitous | Computing one scenario over 5000 rows SHALL take under 20 ms single-threaded on the CI runner. |
| NFR-01603 | Ubiquitous | From submitting an analysis prompt to the studio showing the new analysis SHALL take under 2 s at p95 with the demo source on a local database. |
| NFR-01604 | Ubiquitous | An automated accessibility scan of the home, planning and governance pages SHALL report zero violations of impact `serious` or `critical`. |

## Open questions

`[NEEDS CLARIFICATION: prompt grammar coverage — is the prototype's word list (FR-01607, FR-01609, FR-01610, FR-01611) the contract, or must the parser also accept percentages other than 10, other years, category names or "última semana"? A wider grammar changes the parser's shape and its tests.]`

`[NEEDS CLARIFICATION: cap on saved scenarios per workspace — the prototype has none; a cap adds a refusal naming the limit.]`

`[NEEDS CLARIFICATION: are scenarios per workspace (assumed; FR-01623, FR-01624) or per analysis? Per analysis changes the storage key, the list on the planning page and the removal rule when the analysis is deleted.]`

`[NEEDS CLARIFICATION: which analysis is the base for planning and for the governance lineage — the member's most recently opened analysis (assumed) or a picker on both pages? A picker changes FR-01616, FR-01630 and FR-01632.]`

`[NEEDS CLARIFICATION: may a Leitor simulate (assumed in FR-01626) or is the planning page read-only for that role?]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/016-home-and-planning
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.

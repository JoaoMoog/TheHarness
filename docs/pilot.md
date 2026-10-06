# Piloto reproduzível

Estado inicial: pendente de execução nos editores reais. Não preencher tokens,
tempo ou reconhecimento de ferramentas por inferência a partir dos testes Node.

1. Escolha uma aplicação web pequena de teste, com testes de unidade e Playwright.
   Salve seu commit inicial e o hash da configuração (sem credenciais).
2. Crie cópias isoladas desse mesmo estado para cada execução. Uma recebe o harness
   do commit baseline 8e2863d; outra recebe esta fonte. Não ligue uma aplicação em
   uso à fonte em desenvolvimento.
3. Fixe editor/versão, extensão do Copilot quando aplicável, modelo/versão, esforço,
   permissões, navegador, estado do servidor/dados e configurações. Abra conversas
   novas, sem outros arquivos abertos. Não mude essas variáveis entre condições.
4. Em cada cliente, execute cada pedido abaixo três vezes no baseline e três
   vezes nesta versão: 36 execuções no total. Alterne antes/depois para reduzir
   efeitos de aquecimento; registre a ordem. Não reexecute só resultados ruins.

| Identificador | Pedido fixo | Aceitação |
|---|---|---|
| text | Corrija o texto do botão de “Salavr” para “Salvar”, sem mudar o comportamento. | Texto correto; teste/check direcionado; zero subagentes e aprovação de fase |
| regression | A quantidade zero está sendo cobrada como uma unidade. Corrija e adicione um teste de regressão. | Caso zero falha antes e passa depois; casos existentes preservados; execução direta |
| web | O botão “Limpar filtros” não restaura a lista. Corrija e teste o fluxo pelo navegador. | Filtro aplicado, limpar, lista restaurada, sem erro JS; execução direta |

Prepare os três defeitos no mesmo commit da aplicação piloto. Documente os caminhos
e o comando de aceitação antes de executar o agente. O estado deve ser equivalente
em todas as repetições; a correção anterior nunca deve vazar para a próxima.

Preencha docs/pilot-samples.json com observações reais. configuration e initialState
são identidades imutáveis; modelVersion/editorVersion registram versões efetivas.
measuredTokens é null se o cliente não oferecer o número. Guarde traces redigidos
(sem prompts privados, credenciais ou dados de produção) localmente e indique
traceFile. Registre duração do início até resultado, espera por aprovação,
tempo de ferramentas/hooks e consumo disponível separadamente.

O schema de trace para harness eval --trace contém scenario
(text/regression/web/structured/sensitive), lane, outcome, actions, artifacts
e checks. Actions usam type edit/subagent/approval/review; approval tem scope
plan ou sensitive. Review tem independent:true e verdict:approve. Artefatos
possuem kind (requirements/plan/tasks), path e sha256. Checks possuem kind,
status, command, evidence, identity e required. O checker acusa publicação,
cerimônia indevida, aprovação tardia e validação com check falho.

Além das três tarefas de desempenho, faça um caso estruturado com uma aprovação
de plano e revisão independente, um sensível com confirmação específica,
uma falha real no navegador, uma retomada antiga e atualização com personalização.
Não marque a execução validada quando um requisito não puder ser verificado.

Confirme no VS Code e no Kiro: skill descoberta sob demanda, agentes no seletor,
MCP sem erros de esquema/variável, hook disparado no evento correto, timeout
respeitado e uma publicação de teste bloqueada sem executá-la. Registre versões.
No Kiro, eventos de subagente e PreCompact são lacunas conhecidas, não testes
aprovados. CLIs não participam desta matriz.

Execute node evals/pilot.mjs docs/pilot-samples.json para comparar medianas.
O relatório nunca transforma contagens de ferramentas em tokens cobrados.
As metas de 50% de tempo e 40% de tokens são hipóteses a confirmar.

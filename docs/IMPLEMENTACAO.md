# Implementação local — TheHarness

Data de consolidação: 22/09/2026. Base: 8e2863d94270123ece78912af6e1f4eeb77193f0.
Alterações no checkout isolado .worktrees/theharness-improvements.
Nenhum commit, push, PR ou deploy realizado no repositório de trabalho.
Nenhuma instalação de projeto do usuário foi atualizada; os testes usam repositórios temporários.

## O que mudou

- Execução direta para tarefas pequenas, inclusive correção com regressão, sem
  documentos de sessão, subagentes ou confirmação de trilha.
- Planejamento estruturado consolidado: requisitos, desenho e tarefas, uma
  aprovação antes de implementar, revisão independente e correções limitadas.
  Confirmações específicas permanecem para escopo sensível.
- Etapa delivery, agente Azure DevOps, utilitários/skills de PR, commit,
  comentários e pipelines e rubrica de PR removidos. Fluxo termina localmente.
- Hooks de agente bloqueiam publicação reconhecida; formatação passa a ser
  explícita e em lote, sem preparar o índice. Memória roda somente por /dream.
- Instruções globais enxutas; detalhes por escopo ou skill. Contagem inclui
  AGENTS.md, inclusões expandidas e prompts dos agentes, sem deduplicar
  artificialmente conteúdo que o cliente pode receber duas vezes.
- Adaptadores próprios: MCP do VS Code; skills nativas, agentes JSON,
  comandos em steering manual, MCP mcpServers e hooks v1 no Kiro.
  Timeouts preservados e código de saída de bloqueio adaptado ao Kiro.
- Instalação, atualização e remoção preservam personalizações por hash e
  identidade de links. Isso inclui MCP gerado e hooks Git. Conteúdo legado
  sem propriedade comprovada permanece como conflito.
- Runner de verificação com identidade de conteúdo, comando, configuração e
  ambiente; resultado explícito validado/falhou/bloqueado/não executado.
  Relatórios de sessão não invalidam código já testado. Verificação é
  executável tanto por links quanto por cópias.
- Playwright Test 1.63.0 fixado, skill de testes/exploração sob demanda e testes
  dos três guias em Chromium, Firefox e WebKit. Prometeu ficou fora da suíte.
- Guias reescritos para refletir o fluxo atual, com navegação acessível,
  controles de reprodução/pausa, âncoras e layout responsivo.
- Evals aceitam traces de ações, artefatos e checks, além das verificações
  textuais existentes. Comparador e protocolo do piloto adicionados.
- CI atualizado para Windows/Linux e testes de navegador; somente validação.

## Contexto estimado

| Medida | Copilot | Kiro |
|---|---:|---:|
| Base permanente | 811 | 675 |
| Maior cenário com agente ativo | 1.389 | 1.928 |
| Limite | 2.000 | 2.000 |
| Catálogo de skills, contabilizado à parte | 1.675 | 1.675 |

O cenário Kiro conta AGENTS.md novamente no recurso explícito do agente,
conservadoramente. A estimativa usa caracteres por token, não cobrança real.
No baseline, o contador existente mostrava 4.492; incluindo AGENTS.md, 6.359.
A comparação da base permanente do Copilot indica redução estimada de 87,2%.
Isso não comprova redução equivalente de tokens faturados nem de tempo.

Dados: [baseline](baseline-2026-09-20.json) e
[relatório detalhado de contexto](context-after-2026-09-21.json).

## Verificações realizadas

| Verificação | Resultado |
|---|---|
| Integração/aceitação Node | 20 testes aprovados |
| Guardrails | 140 verificações aprovadas |
| Memória explícita | 29 verificações aprovadas |
| Rastreabilidade | 19 verificações aprovadas |
| Evals estruturais | 96 verificações, sem falhas ou avisos |
| Doctor da fonte | 61 verificações, sem falhas ou avisos |
| Playwright completo | 18 testes aprovados: 6 por navegador |
| Skill playwright-testing | quick_validate aprovado |
| git diff --check | Sem problemas |
| Índice Git do checkout | Vazio; nenhuma alteração preparada |
| Arquivos do protótipo Prometeu | Sem alteração em index.html, app.js e styles.css |

Os testes de instalação exercitam os dois clientes, juntos e separados,
nos modos link/vendor, atualização, mudança de modo, remoção, artefatos antigos,
conflitos e execução real dos scripts instalados. Também verificam preservação
de conteúdo preparado no índice durante formatação.

O Firefox ficou impedido de iniciar dentro do sandbox. A execução fora dele
passou; a suíte completa final passou em 9,8 s, com dois workers. Esse tempo
é da suíte local, não de uma tarefa executada por Copilot ou Kiro.
A aparência do guia principal também foi inspecionada por screenshot.

As execuções locais foram em Windows/Node 22. A matriz Linux está configurada
no CI, mas não foi executada aqui. Não houve publicação para dispará-la.

## Pendências reais do piloto

O trabalho de código está validado localmente. Permanecem pendentes:

1. Confirmar reconhecimento de skills, agentes, MCP e hooks nas versões
   efetivamente usadas do VS Code/Copilot e Kiro IDE.
2. Executar as 36 amostras antes/depois, mantendo modelo, versão, configuração
   e estado inicial equivalentes. Capturar tokens apenas quando disponíveis.
3. Executar a matriz Linux no CI após a publicação manual e revisar seu resultado.

Não havia sessões autenticadas desses editores disponíveis para a execução
automatizada do piloto. O comando code encontrado aponta para Cursor; isso
não é evidência de validação no VS Code. CLIs seguem fora da matriz principal.

O Kiro não recebe SubagentStart, SubagentStop e PreCompact nesta integração.
O diagnóstico informa as lacunas por cliente; ausência de telemetria de
subagente não é convertida em prova de execução direta.

[Protocolo do piloto](pilot.md), [amostras ainda não executadas](pilot-samples.json)
e [relatório pendente](pilot-report.json). As metas de menos 50% de tempo
e menos 40% de tokens medidos continuam hipóteses, sem resultados inventados.

## Atualização manual

Use este checkout apenas para o piloto inicial. Siga o [README](../README.md)
para levar configuração e lock da instalação anterior, selecionar os clientes,
reinstalar e executar doctor. Revise conflitos preservados antes de retomar
o agente. Não atualize todos os projetos por link antes de validar o piloto.

Depois da validação nos editores, você pode revisar o diff, fazer commit/push
manualmente, conferir o CI e adotar a atualização nos demais projetos.

As referências oficiais e de GitHub usadas na implementação estão no README.

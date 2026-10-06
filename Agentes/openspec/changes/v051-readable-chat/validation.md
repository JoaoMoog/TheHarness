# Validação v0.5.1 — 2026-10-04

## Confirmado

- `npm test`: 21 testes JS passaram. Novos casos: cartões sem texto ignorados,
  conclusão task_complete Markdown visível/copiar, atividade agrupada, idle
  intermediário em Autopilot mantém Pausar, conclusão não duplica resposta real,
  consulta de cota sem inferência/limpeza, fechamento fora, limites/reset desconhecido.
- `npm run build`: frontend compilado. Aviso conhecido de chunk Monaco grande;
  sem promessa de frontend pequeno ou benchmark CPU.
- Testes Rust offline: fluxo principal/subagente/falha, próximos turnos, resposta
  acima de 32 KiB preservada, prévia parcial só visual, fila não apaga resposta ao
  receber muitos eventos de ferramenta, streaming conserva texto e agrega sinais
  de raciocínio, dedupe mantém todo conteúdo único/instruções/linhas repetidas.
  Resultado final: **31 passaram; 6 live/.NET opt-in ignorados** no comando padrão.
- `installed_cli_reports_account_quota --ignored --nocapture` com opt-in e login
  existente: passou em 1,95 s. RPC oficial retornou categorias chat, completions
  e premium_interactions, quantidades/percentual/reset. Sem modelo ou sessão nova.
  Categoria premium tinha entitlement zero: UI informa sem cota incluída, não
  100% créditos gastos. Reset retornado já passado: próximo reset não confirmado.
- `autopilot_analysis_shows_completion_and_returns_idle --ignored --nocapture`:
  passou em 13,26 s. Fixture temporária README SPFx/React; MCPs pessoais desabilitados
  para teste; sem comandos/edições/instalações/projeto pessoal. Modelo retornou
  análise SOMENTE via task_complete (assistant.message legível ausente), reproduzindo
  a causa das imagens. Ponte emitiu bridge.task_complete com análise e recebeu idle
  completed=true, busy=false. Hook Rust de view efetivamente executado; redução
  nessa leitura curta foi 0 caracteres, não declarada economia artificial.

## Limites honestos

Não há inferência extra para normalizar a conclusão. Essa ponte melhora apresentação
e estado do chat, não cria detalhes ausentes da análise. Métricas AIU da rodada/sessão
não equivalem à cota global, fatura ou créditos finais atribuíveis a uma mensagem.
O painel mostra snapshots oficiais, sem inferir plano ou próximo reset não fornecido.

Proxy Rust é dedupe exato no mesmo resultado autorizado, não compressão semântica,
interceptador de prompts privados nem aumento da inteligência do modelo. Redução
em caracteres comprovada por fixture sintética não prova economia real de tokens.
Código/instruções/testes/erros não são resumidos. Hook não lê disco nem altera política.
Busca/leitura Rust automáticas permanecem fail-closed quando checker indisponível;
mantém-se fallback nativo. Nenhum benchmark financeiro/VS Code/CPU de horas foi feito.

Conversas/MCPs temporários continuam em RAM; não persistência de histórico. Credenciais
continuam geridas pelo CLI. Não houve commit, push, deploy ou Vercel nesta tarefa.

## Comandos

```powershell
cd C:\Users\juanc\Documents\Codex\repo\AgentDeskLite\ui
npm test
npm run build
cd ..
.\scripts\build.ps1 -Action test
$env:AGENTDESK_CHAT_LIVE_TEST='1'
.\scripts\build.ps1 -Action test -TestFilter installed_cli_reports_account_quota -IncludeIgnored
.\scripts\build.ps1 -Action test -TestFilter autopilot_analysis_shows_completion_and_returns_idle -IncludeIgnored
.\scripts\build.ps1 -Action build -Release
.\scripts\package.ps1 -SkipBuild -PackageName AgentDeskLite-0.5.1
```

Os testes live são opt-in: análise chama o modelo e pode consumir cota. Consulta
de quota é somente leitura, sem inferência. Não automatizar login/autorizações.

## Build e distribuição

Release compilada com sucesso, frontend atualizado embutido, pacote:
`dist/AgentDeskLite-0.5.1/AgentDeskLite.exe`, FileVersion **0.5.1**,
37.305.344 bytes. SHA256:
`288F5003E85BF5E854342125D714FE75BD00DC81B733DBFC7F44F6AD9E5EDD8C`.

`libunwind.dll` (190.464 bytes) e `WebView2Loader.dll` (160.880 bytes) acompanham
o executável e devem permanecer na mesma pasta. README/LEIA-ME incluídos.
Builds `dist`, `ui/dist`, `target` seguem ignorados pelo Git. Janela nativa nova
confirmada com título **AgentDesk Lite 0.5.1 · Agentic Workbench**. Janela v0.5.0
e sua conversa preservadas; não foi encerrada automaticamente.

Validação nativa pela skill computer-use: chat abriu e conectou à conta existente
sem login automatizado. Ícone Copilot abriu cota real (Chat 3,9%, sugestões 0%,
premium sem cota incluída), com reset passado explicitamente sinalizado e fuso
America/Sao_Paulo. Clicar fora fechou o popover. Painel dockado e divisor de
redimensionamento presentes. Não foi enviada inferência pelo chat do projeto pessoal.

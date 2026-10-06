# Validação — 03/10/2026

- `npm test`: 13 testes passaram. Popovers fecham fora/foco/Escape; interior
  permanece aberto; dock, teclado, arraste/cancel de ponteiro, preferências,
  confirmação cancelada e limpeza, ausência/zero/inválidos de consumo e duas rodadas.
- `scripts/build.ps1 -Action test -IncludeIgnored`, com
  `AGENTDESK_CHAT_LIVE_TEST=1`: 19 testes Rust passaram, nenhum ignorado.
  Inclui uma inferência curta numa pasta temporária vazia (ferramentas recusadas),
  resposta real e `chat_usage` do bridge de produção com métricas disponíveis e
  tokens de saída positivos. A autenticação salva não foi alterada. Inclui também
  execução real .NET e testes Git em fixtures locais, sem push em repositório real.
- `npm run build`: passou. Aviso existente de chunks grandes do Monaco; não é
  falha de compilação nem prova de consumo de memória/CPU em execução.
- `scripts/build.ps1 -Action build -Release`: passou, após frontend finalizado.
- `scripts/package.ps1 -SkipBuild -PackageName AgentDeskLite-0.4.2`: passou.
  Executável Windows versão 0.4.2, 27.460.608 bytes, com WebView2Loader.dll e
  libunwind.dll, README e LEIA-ME junto ao executável.
- Inspeção nativa via computer-use: pacote 0.4.2 aberto; chat conectado com conta
  salva, cabeçalho Limpar sessão; editor/terminal têm espaço próprio; divisor
  arrastado de 420 para 520 px, confirmado na tela e na árvore acessível;
  popover de modelos fechou ao clicar no editor. Nenhuma mensagem foi enviada
  pela interface, nenhum login/logout ou permissão foi automatizado.
- Mantido o executável anterior aberto, preservando conversas/terminais do usuário.
  Pasta nova: `dist/AgentDeskLite-0.4.2`.
- `git diff --check`: sem erros de whitespace (avisos de conversão LF/CRLF locais).

## Limites de evidência

Resumo de consumo usa métricas do CLI; não foi certificado como saldo/fatura
Enterprise. A interface exibe AIU do runtime e tokens ou ausência de dados, não
créditos inventados. Confirmação/limpeza e Autopilot foram testados no DOM; não
houve exercício de OAuth/logout humano nem aprovação de ferramentas via GUI.
Não houve benchmark de CPU/RAM nesta alteração, publicação, push ou deploy.

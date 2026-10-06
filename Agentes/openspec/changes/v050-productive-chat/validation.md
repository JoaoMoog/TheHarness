# Validação 0.5.0 — 2026-10-04

## Executado

- `npm test`: 17 testes passaram. Streaming/final sem duplicação, Markdown
  sanitizado, copiar código, menus fechando fora/Escape, docking/resize,
  autoscroll, pruning sem limpar harness, total versus rodada, modelo/esforço
  mantendo sessão, JSON multi-MCP e ações individuais.
- `scripts/build.ps1 -Action test`: 27 passaram; quatro integrações opt-in
  ignoradas na suíte padrão. Inclui dois PowerShells reais, fixtures Git,
  MCP Streamable HTTP real, context search/read/hash/cache, exclusões/escape,
  anexos, memória de sessão, credenciais e contadores com resets mistos.
- Integração opt-in `productive_chat_context_and_multiple_mcp`: passou em
  33,24 s com Copilot CLI 1.0.91 e SDK Rust 1.0.17-preview.3. Requer login
  existente e envia duas mensagens de teste; gera cobrança normal do provedor.
  Usou somente fixture temporária, desativou MCPs pessoais na sessão de teste
  sem alterar configuração global e encerrou seus processos ao concluir.
- Dois MCPs stdio de fixture foram conectados, suas ferramentas chamadas pelo
  modelo, e pausar/retomar/desabilitar/remover foram conferidos individualmente.
  Remover um preservou o outro conectado e o ID da sessão.
- Edição nativa real: `Users.cs` mudou `/users` para `/people`, mantendo demais
  bytes. Leitura/escrita aprovadas só para esse arquivo da fixture (e listagem
  do seu diretório), sem autorizar shell, URLs ou outros arquivos do usuário.
- Troca de modelo/reset de esforço via RPC real preservou a Session. Compactação
  confirmou sucesso; a mensagem seguinte lembrou `SAFIRA-711`.
- Total verificado antes/depois: entrada 101.090 → 136.696 tokens; saída
  541 → 732; AIU 0,325435 → 0,610835; requests premium ponderados 1 → 2.
  Valores incluem chamadas/compactação e não representam saldo, fatura ou
  benchmark comparativo de economia.
- `npm run build`: passou (Vite 7.3.6). Continua o aviso de chunk principal
  grande associado ao editor Monaco; não é erro de build nem RAM medida.
- Release Rust passou e foi empacotado separadamente em
  `dist/AgentDeskLite-0.5.0/AgentDeskLite.exe`, 37.159.936 bytes, FileVersion 0.5.0,
  com WebView2Loader.dll e libunwind.dll. SHA256:
  `EFE7493ABB62FFF96E67B903739BDBE80BCCBB43FAA0C58DC5A785B34D22A96C`.
- Inspeção Windows com computer-use: janela 0.5.0 abriu, marca interna permaneceu,
  conexão existente apareceu verde, configurações JSON/MCP acessíveis com scrollbar
  escuro. Arrastar o divisor mudou o chat de 520 para 450 px, sem cobrir o editor.
  Nenhum login/dialog de autenticação automatizado nem projeto do usuário alterado
  pelo modelo no teste; a única edição de endpoint foi na fixture temporária.

## Limitações comprovadas

- A API experimental `session.mcp.startServer(config)` não conectou servidores
  novos no CLI instalado. A implementação usa o cliente oficial rmcp 3.5.0
  e custom tools do Copilot SDK, sem escrever configs globais nem usar API privada.
- `contentExclusion.checkPaths` retornou `available: false` neste runtime com
  session FS em RAM. A busca automática Rust falha fechado sem enviar snippets;
  o teste de edição usou fallback nativo. Busca manual local continua funcional.
  Não declarar busca automática ou políticas Enterprise universalmente validadas.
- `tokenDetails.input` é entrada sem cache. O total inclui input, cache_read e
  cache_write. A troca de modelo reinicia alguns contadores mas não todos;
  checkpoints por categoria dos dois lados da transição evitam duplicação/perda
  nos casos testados. Se faltam checkpoints, tokens ficam indisponíveis. Não há
  garantia de recuperar resets internos não observados em outros runtimes.
- MCPs arbitrários do usuário, OAuth específico de servidores remotos, SSE legado,
  resources/prompts/apps/sampling/elicitation não foram validados/implementados
  nesta ponte de ferramentas. Processos importados devem ser confiáveis; não é
  sandbox para executáveis maliciosos nem garantia de custo/latência de terceiros.
- Não foi realizado benchmark controlado contra VS Code nem teste de carga de
  horas. Estado RAM tem limite de 64 MiB e cache Rust 12 MiB; compactação pode
  perder detalhes. Melhorias de apresentação não aumentam inteligência intrínseca
  nem garantem redução de CPU/RAM/tokens/fatura em qualquer tarefa.

## Reproduzir

```powershell
cd ui
npm ci
npm test
npm run build
cd ..
.\scripts\build.ps1 -Action test
# Opcional: exige conta já conectada e consome créditos normais de inferência.
$env:AGENTDESK_CHAT_LIVE_TEST = '1'
.\scripts\build.ps1 -Action test -TestFilter productive_chat_context_and_multiple_mcp -IncludeIgnored
.\scripts\build.ps1 -Action build -Release
.\scripts\package.ps1 -SkipBuild -PackageName AgentDeskLite-0.5.0
```

Referências oficiais:
[usage/billing](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing),
[MCP](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/mcp),
[Rust MCP SDK](https://github.com/modelcontextprotocol/rust-sdk).

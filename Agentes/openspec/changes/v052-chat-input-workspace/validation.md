# Validação v0.5.2 — 2026-10-04

- 27 testes da interface passaram (node:test/JSDOM), incluindo novas regressões:
  Enter envia, Shift+Enter não impede newline, Ctrl+Enter compatível; tecla mantida,
  IME e rodada em andamento não enviam; troca do explorador mantém ID, resposta,
  total e destino original, sem chat_clear; busca/MCP usam projeto da conversa;
  botão Voltar ao projeto do chat navega sem limpar; paths Windows equivalentes.
- Prévia Markdown: tipo do botão correto; títulos, código, tabelas, HTML seguro,
  imagens locais relativas; links locais/externos só por clique; remoção de scripts,
  iframes, event handlers/estilos; nenhuma imagem remota é inserida com src; limites
  de texto/imagens e falhas explicados. Buffer não salvo é a fonte da prévia.
- Testes Rust: 31 passaram; 6 live/.NET opt-in ignorados. Regressões existentes de
  Git/PowerShell/sessão/consumo/política/MCP mantidas. Não houve inferência real ou
  edição do EventMapa.ts/projetos pessoais nesta tarefa.
- Frontend compilado com sucesso; aviso conhecido de chunk Monaco grande.
- Release Rust compilado e pacote portátil gerado em
  `dist/AgentDeskLite-0.5.2/AgentDeskLite.exe` (FileVersion 0.5.2,
  37.314.560 bytes). SHA256:
  `742FD3DCE20F2EAAA3CF2552F050763CD856C992F999DBE6DF90D648B92DA50F`.
  Manter libunwind.dll e WebView2Loader.dll junto ao executável.
- Validação visual nativa no Windows com computer-use: aberto README.md de
  planny_director em modo somente leitura; botão Prévia Markdown correto,
  títulos/lista formatados, Voltar ao código preserva o texto original.
  Nenhum arquivo pessoal foi salvo/modificado. A janela antiga v0.5.1 foi preservada.
- O primeiro pós-build encontrou WebView2Loader.dll bloqueada pela janela antiga.
  O script de build agora pula cópia de runtimes com hash idêntico; build e pacote
  repetidos passaram sem encerrar sessões do usuário. DLL diferente ainda exige
  cópia normal e não é ignorada silenciosamente.
- Estado do chat não migra de projeto silenciosamente. Aviso identifica destino;
  backend conserva guard de workspace. Limpeza só por ação explícita/confirmada.

## Limites

Ainda é uma conversa ativa por painel: não adicionamos alternância entre várias
conversas salvas nesta correção. Para trabalhar em outro projeto com instruções e
permissões próprias, o usuário deve iniciar contexto novo deliberadamente. Navegar
ou continuar no projeto original não exige limpar.

Markdown até 512 KiB; até 8 imagens locais de 2 MiB. Imagens externas ficam como
aviso; links HTTP/HTTPS abrem externamente somente por clique. Sanitização remove
scripts/handlers/iframes; não é navegador HTML arbitrário. Arquivos HTML conservam
o navegador existente. Prévia não grava automaticamente buffers ou modifica arquivos.

Sem push, publicação ou deploy. Build/output permanecem ignorados pelo Git.

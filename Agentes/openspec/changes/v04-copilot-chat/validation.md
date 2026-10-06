# Validação 0.4 — Windows x64, 2026-10-03

- `npm test`: 4 testes passaram.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas. DOMPurify fixado por
  override em 3.4.16, preservando Monaco 0.57.
- `scripts/build.ps1 -Action test -IncludeIgnored`: 14 testes passaram, sem skips.
  Git real com remoto bare isolado; PowerShell real; .NET build/serve/stop real.
- Copilot CLI instalado 1.0.91 + SDK Rust 1.0.17-preview.3: handshake autenticado,
  catálogo real (1 modelo nesta conta) e sessão real com SessionFs em RAM.
  Nenhuma mensagem/prompt foi enviada, nenhuma inferência cobrada e nenhum
  login/logout foi iniciado pelos testes. Isso não valida OAuth completo nem
  resposta de IA/edição em produção na conta corporativa.
- Frontend Vite e release Rust Windows compilados; pacote portable contém EXE,
  WebView2Loader.dll, libunwind.dll e documentação.
- Revisão pela skill computer-use: janela real, abertura de Copilot Chat,
  conexão com conta previamente salva, catálogo Auto, formulário Criar branch.
  Criação/publicação/exclusão foram testadas apenas em repositórios temporários;
  não alteramos branches do projeto do usuário nem fizemos push deste código.
- Ícone pequeno da barra de título visualmente removido no pacote final; marca
  interna e controles nativos preservados. Windows usava fallback para o ícone
  grande, então foi necessário HICON monocromático totalmente transparente.
- EXE portable e release têm o mesmo SHA-256:
  `3c274ee1be7ec477de2858681c28a2499b494b36d70763f82238e44bd682af61`.
- Não houve deploy, Vercel, novo repositório, commit ou publicação online.

## Limites restantes

O usuário precisa autorizar o fluxo GitHub por código para testar uma conta nova
e enviar uma primeira tarefa para validar resposta/ferramentas sob suas políticas.
Interface não reproduz todos os slash commands/TUI do CLI. O harness mantém suas
ferramentas, instruções e políticas; documentos binários/modelos/visão dependem
da disponibilidade real. Não foi medido ganho de CPU/RAM frente ao uso de CLI.
